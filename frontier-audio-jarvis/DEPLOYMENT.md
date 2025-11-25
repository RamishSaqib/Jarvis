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

## Quick Start: One-Click Deployment

### Step 1: Deploy to Render (5 minutes)

1. **Fork or push your code to GitHub** (if not already done)

2. **Go to [render.com](https://render.com)** and sign up (free, no credit card)

3. **Click "New" → "Blueprint"**

4. **Connect your GitHub repository**

5. **Render will detect `render.yaml`** and show you:
   - `jarvis-ai-service` (AI Service)
   - `jarvis-backend` (Backend)

6. **Set environment variables** (click "Edit" on each service):
   
   **For AI Service:**
   - `OPENAI_API_KEY` = your OpenAI API key
   - `GITHUB_TOKEN` = your GitHub token (optional)
   
   **Backend will auto-configure** with AI service URL

7. **Click "Apply"** - Render will deploy both services

8. **Wait 5-10 minutes** for deployment to complete

9. **Copy your backend URL** (e.g., `https://jarvis-backend.onrender.com`)

### Step 2: Deploy to Vercel (3 minutes)

1. **Go to [vercel.com](https://vercel.com)** and sign up (free)

2. **Click "Add New" → "Project"**

3. **Import your GitHub repository**

4. **Configure:**
   - Framework Preset: **Next.js**
   - Root Directory: **`frontend/frontend`**

5. **Add environment variable:**
   - Name: `NEXT_PUBLIC_BACKEND_URL`
   - Value: `wss://jarvis-backend.onrender.com` (your backend URL from Step 1, change `https` to `wss`)

6. **Click "Deploy"**

7. **Your site is live!** 🎉

## Step 3: (Optional) Keep Services Awake

Free tier services sleep after 15 minutes. Here are options to keep them awake:

### Option A: UptimeRobot (Recommended - Free)

1. **Sign up at [uptimerobot.com](https://uptimerobot.com)** (free)

2. **Add two monitors:**
   - Monitor 1: `https://jarvis-ai-service.onrender.com`
   - Monitor 2: `https://jarvis-backend.onrender.com/health`

3. **Set interval to 14 minutes**

4. **Done!** Services will stay awake 24/7

### Option B: Cron-job.org (Free)

1. **Sign up at [cron-job.org](https://cron-job.org)** (free)

2. **Create two cron jobs:**
   - URL 1: `https://jarvis-ai-service.onrender.com`
   - URL 2: `https://jarvis-backend.onrender.com/health`
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
   */14 * * * * /path/to/keep-alive.sh
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

### Audio Recording Doesn't Work
- **Cause**: HTTPS required for microphone access
- **Solution**: Vercel provides HTTPS automatically
- **Check**: You're accessing via HTTPS, not HTTP

### AI Service Errors
- **Check**: OpenAI API key is valid and has credits
- **Check**: Environment variables are set in Render
- **Check**: Render logs for detailed error messages

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

---

**Congratulations!** You now have a fully functional, free voice assistant deployed on the web! 🎉
