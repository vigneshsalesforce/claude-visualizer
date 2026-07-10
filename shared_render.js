/*
 * Parses Claude Code's native JSONL session transcript format and builds a
 * turn tree + tool-call index for rendering. No dependencies, no build step.
 * Shared between replay.html (static, load-a-file) and viewer.html (live,
 * appended to incrementally by tail_server.py).
 */
(function (global) {
  'use strict';

  function parseJSONL(text) {
    var lines = text.split('\n');
    var records = [];
    var parseErrorCount = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      try {
        records.push(JSON.parse(line));
      } catch (e) {
        parseErrorCount++;
      }
    }
    return { records: records, parseErrorCount: parseErrorCount };
  }

  function extractText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map(function (b) {
          if (typeof b === 'string') return b;
          if (b && b.type === 'text') return b.text;
          return '';
        })
        .join('\n');
    }
    return '';
  }

  // One entry per tool_use id: { id, name, input, callTimestamp, callUuid,
  // result: null | {content, isError, resultTimestamp, toolUseResult},
  // durationMs, isAgent, agentId, agentStatus, agentSummary }
  function buildToolCallIndex(records) {
    var toolCalls = new Map();

    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === 'assistant' && r.message && Array.isArray(r.message.content)) {
        for (var j = 0; j < r.message.content.length; j++) {
          var block = r.message.content[j];
          if (block.type === 'tool_use') {
            toolCalls.set(block.id, {
              id: block.id,
              name: block.name,
              input: block.input,
              callTimestamp: r.timestamp,
              callUuid: r.uuid,
              result: null,
              durationMs: null,
              isAgent: block.name === 'Agent',
              agentId: null,
              agentStatus: null,
              agentSummary: null
            });
          }
        }
      }
    }

    for (var k = 0; k < records.length; k++) {
      var ru = records[k];
      if (ru.type === 'user' && ru.message && Array.isArray(ru.message.content)) {
        for (var m = 0; m < ru.message.content.length; m++) {
          var rb = ru.message.content[m];
          if (rb.type === 'tool_result') {
            var entry = toolCalls.get(rb.tool_use_id);
            if (!entry) continue; // orphaned result — parent call not in this file
            entry.result = {
              content: rb.content,
              isError: rb.is_error === true, // is_error can be null/absent on success
              resultTimestamp: ru.timestamp,
              toolUseResult: ru.toolUseResult || null
            };
            entry.durationMs = new Date(ru.timestamp) - new Date(entry.callTimestamp);
            if (entry.isAgent && ru.toolUseResult) {
              entry.agentId = ru.toolUseResult.agentId || null;
              entry.agentStatus = ru.toolUseResult.status || null;
              if (entry.agentStatus === 'completed') {
                entry.agentSummary = {
                  totalDurationMs: ru.toolUseResult.totalDurationMs,
                  totalTokens: ru.toolUseResult.totalTokens,
                  totalToolUseCount: ru.toolUseResult.totalToolUseCount,
                  toolStats: ru.toolUseResult.toolStats
                };
              }
            }
          }
        }
      }
    }

    return toolCalls;
  }

  // Builds a forest from parentUuid/uuid. Orphans (parent not present in
  // this file, or a truncated transcript) become synthetic roots.
  function buildForest(records) {
    // attachment lines are included so the parent/child chain stays intact
    // (an attachment can sit between two real turns); whether to *render*
    // them is a display-layer decision, not a tree-topology one.
    var convo = records.filter(function (r) {
      return r.type === 'user' || r.type === 'assistant' || r.type === 'attachment';
    });
    var byUuid = new Map();
    for (var i = 0; i < convo.length; i++) {
      var r = convo[i];
      if (r.uuid) {
        r.__children = [];
        byUuid.set(r.uuid, r);
      }
    }
    var roots = [];
    for (var j = 0; j < convo.length; j++) {
      var rr = convo[j];
      if (!rr.uuid) continue;
      if (rr.parentUuid && byUuid.has(rr.parentUuid)) {
        byUuid.get(rr.parentUuid).__children.push(rr);
      } else {
        roots.push(rr);
      }
    }
    function sortRec(list) {
      list.sort(function (a, b) {
        return new Date(a.timestamp) - new Date(b.timestamp);
      });
      for (var i2 = 0; i2 < list.length; i2++) sortRec(list[i2].__children);
    }
    sortRec(roots);
    return roots;
  }

  function isToolResultMessage(r) {
    return (
      r.type === 'user' &&
      r.message &&
      Array.isArray(r.message.content) &&
      r.message.content.length > 0 &&
      r.message.content[0].type === 'tool_result'
    );
  }

  // Full pipeline: JSONL text -> { roots, toolCalls, meta, parseErrorCount, attachmentCount }
  function processTranscript(text) {
    var parsed = parseJSONL(text);
    var records = parsed.records;
    var attachmentCount = records.filter(function (r) {
      return r.type === 'attachment';
    }).length;
    var toolCalls = buildToolCallIndex(records);
    var roots = buildForest(records);

    var sessionId = null,
      agentIdOfFile = null,
      isSidechainFile = false;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.sessionId && !sessionId) sessionId = r.sessionId;
      if (r.agentId && !agentIdOfFile) agentIdOfFile = r.agentId;
      if (r.isSidechain) isSidechainFile = true;
    }

    return {
      records: records,
      parseErrorCount: parsed.parseErrorCount,
      attachmentCount: attachmentCount,
      toolCalls: toolCalls,
      roots: roots,
      meta: {
        sessionId: sessionId,
        agentIdOfFile: agentIdOfFile,
        isSidechainFile: isSidechainFile,
        lineCount: records.length
      }
    };
  }

  // Incremental version for live tailing: append new lines to an existing
  // processed transcript's raw record list, then fully rebuild the derived
  // structures. Simpler and safer than surgical incremental tree/index
  // updates; fine for the sizes involved (see viewer.html usage).
  function appendLines(existingText, newLinesText) {
    var sep = existingText && !existingText.endsWith('\n') ? '\n' : '';
    return existingText + sep + newLinesText;
  }

  global.TranscriptRenderer = {
    parseJSONL: parseJSONL,
    extractText: extractText,
    buildToolCallIndex: buildToolCallIndex,
    buildForest: buildForest,
    isToolResultMessage: isToolResultMessage,
    processTranscript: processTranscript,
    appendLines: appendLines
  };
})(typeof window !== 'undefined' ? window : this);
