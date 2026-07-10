# Pushing to GitHub

Your local repository is ready! Follow these steps to push to GitHub:

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Fill in the form:
   - **Repository name**: `claude-visualizer`
   - **Description**: `Interactive visualizer for Claude Code transcript files with timeline and graph views`
   - **Visibility**: Public
   - **Initialize with**: None (leave unchecked - we already have git)
3. Click **Create repository**

## Step 2: Add Remote and Push

Copy the commands from GitHub and run them (or use these):

```bash
# Navigate to the repo (if not already there)
cd /tmp/claude-visualizer

# Add remote (replace with your GitHub URL from step 1)
git remote add origin https://github.com/vigneshsalesforce/claude-visualizer.git

# Create main branch
git branch -M main

# Push to GitHub
git push -u origin main
```

## Step 3: Verify

Visit: https://github.com/vigneshsalesforce/claude-visualizer

You should see all your files!

## Next: Publish to npm

Once pushed to GitHub, publish to npm:

```bash
cd /tmp/claude-visualizer
npm login
npm publish
```

Users can then install with:
```bash
npm install -g claude-code-visualizer
claude-visualizer
```
