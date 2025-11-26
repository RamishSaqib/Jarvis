# Free Deployment Guide for Jarvis Voice Assistant

**Total Cost: $0/month** (only OpenAI API usage)

## Prerequisites
- GitHub account (free)
- Vercel account (free)
- Render account (free)
- OpenAI API key
- (Optional) GitHub Personal Access Token for PR creation

## Important: Free Tier Limitations

### Render Free Tier
- ✅ **Free forever** - no credit card required
- ⚠️ **Services sleep after 15 minutes** of inactivity
- ⏱️ **30-60 second cold start** when waking up
- ✅ **750 hours/month free** (enough for 24/7 operation of one service)
- ✅ **Can be kept awake** with free uptime monitoring

### Vercel Free Tier
- ✅ **Unlimited bandwidth**
- ✅ **100GB/month**
- ✅ **No cold starts**

## Step 1: Deploy AI Service to Render (5 minutes)

1. **Go to [render.com](https://render.com)** and sign up (free, no credit card)

2. **Click "New" → "Web Service"**

3. **Connect your GitHub repository** (`RamishSaqib/Jarvis`)

4. **Configure the service:**
   - **Name**: `jarvis-ai-service`
   - **Root Directory**: `frontier-audio-jarvis/ai-service`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `Dockerfile` (just the filename - Render will look in the Root Directory)
   - **Plan**: `Free`

5. **Add environment variables:**
   - `OPENAI_API_KEY` = your OpenAI API key
   - `GITHUB_TOKEN` = your GitHub token (optional)
   - `GPT_MODEL` = `gpt-4` (optional)

6. **Click "Create Web Service"**

7. **Wait 5-10 minutes** for deployment

8. **Copy the service URL** (e.g., `https://jarvis-ai-service.onrender.com`)

## Step 2: Deploy Backend to Render (5 minutes)

1. **Click "New" → "Web Service"** again

2. **Select the same repository** (`RamishSaqib/Jarvis`)

3. **Configure the service:**
   - **Name**: `jarvis-backend`
   - **Root Directory**: `frontier-audio-jarvis/backend`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `Dockerfile` (just the filename - Render will look in the Root Directory)
   - **Plan**: `Free`

4. **Add environment variables:**
   - `AI_SERVICE_URL` = `wss://jarvis-6bqc.onrender.com/ws/ai` (IMPORTANT: Must use `wss://` not `ws://` to avoid 301 redirects)
   - `PORT` = `3001`

5. **Click "Create Web Service"**

6. **Wait 5-10 minutes** for deployment

7. **Copy the service URL** (e.g., `https://jarvis-backend.onrender.com`)

### 3. Search Configuration (Optional but Recommended)
For reliable general web search (beyond weather), use the Tavily API.
1.  Get a free API key from [tavily.com](https://tavily.com/).
2.  Add `TAVILY_API_KEY` to your environment variables in Render (AI Service).
    *   If not provided, Jarvis will fall back to a custom scraper.

## Step 4: Deploy Frontend to Vercel (3 minutes)

1. **Go to [vercel.com](https://vercel.com)** and sign up (free)

2. **Click "Add New" → "Project"**

3. **Import your GitHub repository** (`RamishSaqib/Jarvis`)

4. **Configure:**
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontier-audio-jarvis/frontend/frontend`

5. **Add environment variable:**
   - Name: `NEXT_PUBLIC_BACKEND_URL`
   - Value: `wss://jarvis-backend.onrender.com` (your backend URL from Step 2, change `https` to `wss`)

6. **Click "Deploy"**

7. **Your site is live!** 🎉

## Step 4: (Optional) Keep Services Awake

Free tier services sleep after 15 minutes. Here are options to keep them awake:

### Option A: UptimeRobot (Recommended - Free)

1. **Sign up at [uptimerobot.com](https://uptimerobot.com)** (free)

2. **Add two monitors:**
   - Monitor 1: `https://jarvis-6bqc.onrender.com/health`
   - Monitor 2: `https://jarvis-backend-gshv.onrender.com/health`

3. **Set interval to 14 minutes**

4. **Done!** Services will stay awake 24/7

### Option B: Cron-job.org (Free)

1. **Sign up at [cron-job.org](https://cron-job.org)** (free)

2. **Create two cron jobs:**
   - URL 1: `https://jarvis-6bqc.onrender.com/health`
   - URL 2: `https://jarvis-backend-gshv.onrender.com/health`
   - Interval: Every 14 minutes

### Option C: Local Script (Free, but requires your computer)

1. **Update `keep-alive.sh`** with your Render URLs

2. **Make it executable:**
   ```bash
   chmod +x keep-alive.sh
   ```

3. **Set up a cron job** (Mac/Linux):
   ```bash
   crontab -e
   ```
   Add:
   ```
   */14 * * * * /path/to/frontier-audio-jarvis/keep-alive.sh
   ```

## Testing Your Deployment

1. **Visit your Vercel URL**

2. **First request may take 30-60 seconds** (cold start)

3. **Click the microphone and speak**

4. **Verify AI responses work**

5. **Test all features:**
   - Voice recording
   - AI responses
   - Passive Mode (wake word)
   - GitHub integration

## Troubleshooting

### "Service Unavailable" Error
- **Cause**: Service is waking up from sleep
- **Solution**: Wait 30-60 seconds and try again
- **Prevention**: Set up keep-alive monitoring

### WebSocket Connection Fails
- **Check**: Backend URL uses `wss://` (not `ws://`)
- **Check**: Environment variable is set in Vercel
- **Check**: Backend service is running in Render dashboard
- **Check**: Root Directory is set correctly in Render

### Audio Recording Doesn't Work
- **Cause**: HTTPS required for microphone access
- **Solution**: Vercel provides HTTPS automatically
- **Check**: You're accessing via HTTPS, not HTTP

### AI Service Errors
- **Check**: OpenAI API key is valid and has credits
- **Check**: Environment variables are set in Render
- **Check**: Render logs for detailed error messages
- **Check**: Root Directory is `frontier-audio-jarvis/ai-service`

### Deployment Fails
- **Check**: Root Directory is set correctly
- **Check**: Dockerfile Path includes `frontier-audio-jarvis/` prefix
- **Check**: All environment variables are set

## Monitoring Your Services

### Render Dashboard
- View logs in real-time
- See deployment status
- Monitor resource usage (all free tier)

### Vercel Dashboard
- View deployment logs
- Monitor bandwidth usage
- See function invocations

## Cost Breakdown

| Service | Cost |
|---------|------|
| Vercel (Frontend) | $0 |
| Render (Backend) | $0 |
| Render (AI Service) | $0 |
| UptimeRobot (Optional) | $0 |
| **Total Hosting** | **$0/month** |
| OpenAI API | Pay-per-use (~$0.002/request) |

## Upgrading Later

If you need to eliminate cold starts:
- Render Starter: $7/month per service (no sleep)
- Railway: $5/month per service (no sleep)
- Vercel Pro: $20/month (not needed for this project)

## Next Steps

- ✅ Deploy and test
- ✅ Set up keep-alive monitoring (optional)
- ✅ Share your Jarvis with friends!
- ✅ Add custom domain (Vercel free tier supports this)

## Support

If you encounter issues:
1. Check Render logs (Render Dashboard → Service → Logs)
2. Check Vercel logs (Vercel Dashboard → Deployment → Logs)
3. Verify environment variables are set correctly
4. Ensure OpenAI API key has credits
5. Verify Root Directory is set to `frontier-audio-jarvis/[service-name]`

---

**Congratulations!** You now have a fully functional, free voice assistant deployed on the web! 🎉
