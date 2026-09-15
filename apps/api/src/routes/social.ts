import { Router } from "express";
import axios from "axios";
import { TwitterApi } from "twitter-api-v2";
import { prisma } from "../lib/prisma.js";
import { sharePost } from "../services/social.service.js";
import type { RequestWithAuth } from "../types.js";

const router: Router = Router();

router.post("/share/:postId", async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { postId } = req.params;
    const { platform } = req.body;

    if (!platform) {
      return res.status(400).json({ success: false, error: "Platform is required" });
    }

    // Call service to share
    const share = await sharePost(postId, platform);

    res.json({ success: true, data: share });
  } catch (error: any) {
    console.error(`Error sharing post ${req.params.postId} to ${req.body.platform}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to share post"
    });
  }
});

router.post("/linkedin/profile", async (req: RequestWithAuth, res) => {
  try {
    const { accessToken } = req.body;

    let sub: string;
    let name: string;

    try {
      // Try the OpenID Connect endpoint first
      const response = await axios.get(
        "https://api.linkedin.com/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      sub = response.data.sub;
      name = response.data.name;
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        // Fallback to the legacy /v2/me endpoint if the user only has r_liteprofile
        const meResponse = await axios.get(
          "https://api.linkedin.com/v2/me",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'LinkedIn-Version': '202401'
            }
          }
        );
        sub = meResponse.data.id;
        name = `${meResponse.data.localizedFirstName} ${meResponse.data.localizedLastName}`;
      } else {
        throw err;
      }
    }

    res.json({
      success: true,
      data: {
        personUrn: `urn:li:person:${sub}`,
        name,
      }
    });
  } catch (error: any) {
    const status = error.response?.status || 500;
    const msg = error.response?.data?.message || "Failed to fetch LinkedIn profile";
    console.error("Error fetching LinkedIn profile:", error.response?.data || error.message);
    res.status(status).json({ success: false, error: msg });
  }
});

router.post("/facebook/pages", async (req: RequestWithAuth, res) => {
  const { userAccessToken } = req.body;
  if (!userAccessToken) {
    return res.status(400).json({ success: false, error: "User Access Token is required" });
  }
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}`
    );
    res.json({
      success: true,
      data: response.data.data // array of pages: { id, name, access_token }
    });
  } catch (err: any) {
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.error?.message || err.message
    });
  }
});

router.post("/instagram/account", async (req: RequestWithAuth, res) => {
  const { pageId, pageAccessToken } = req.body;
  if (!pageId || !pageAccessToken) {
    return res.status(400).json({ success: false, error: "Page ID and Page Access Token are required" });
  }
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
    );
    const igAccount = response.data.instagram_business_account;
    if (!igAccount) {
      return res.status(404).json({ success: false, error: "No connected Instagram business account found for this page." });
    }
    res.json({
      success: true,
      data: {
        igAccountId: igAccount.id
      }
    });
  } catch (err: any) {
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.error?.message || err.message
    });
  }
});

router.post("/instagram/auto-detect", async (req: RequestWithAuth, res) => {
  const { pageAccessToken } = req.body;
  if (!pageAccessToken) {
    return res.status(400).json({ success: false, error: "Page Access Token is required" });
  }
  try {
    const pagesRes = await axios.get(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${pageAccessToken}`
    );
    const pages = pagesRes.data.data;
    if (!pages || pages.length === 0) {
      return res.status(404).json({ success: false, error: "No Facebook pages found for this token." });
    }

    for (const page of pages) {
      try {
        const igRes = await axios.get(
          `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${pageAccessToken}`
        );
        const igAccount = igRes.data.instagram_business_account;
        if (igAccount && igAccount.id) {
          return res.json({
            success: true,
            data: {
              igAccountId: igAccount.id,
              pageName: page.name
            }
          });
        }
      } catch (e) {
        continue;
      }
    }

    return res.status(404).json({
      success: false,
      error: "No connected Instagram Business Account found on any of your Facebook pages."
    });
  } catch (err: any) {
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.error?.message || err.message
    });
  }
});

router.post("/threads/auto-detect", async (req: RequestWithAuth, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ success: false, error: "Access Token is required" });
  }
  try {
    const response = await axios.get(
      `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken}`
    );
    res.json({
      success: true,
      data: {
        id: response.data.id,
        username: response.data.username
      }
    });
  } catch (err: any) {
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.error?.message || err.message
    });
  }
});

router.post("/test", async (req: RequestWithAuth, res) => {
  const { platform, credentials } = req.body;
  if (!platform || !credentials) {
    return res.status(400).json({ success: false, error: "Platform and credentials are required" });
  }
  try {
    if (platform === "FACEBOOK") {
      const { pageId, pageAccessToken } = credentials;
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${pageId}?fields=name&access_token=${pageAccessToken}`
      );
      return res.json({ success: true, message: `Connected to page: ${response.data.name}` });
    }
    else if (platform === "INSTAGRAM") {
      const { igAccountId, pageAccessToken } = credentials;
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${igAccountId}?fields=username&access_token=${pageAccessToken}`
      );
      return res.json({ success: true, message: `Connected to Instagram user: @${response.data.username}` });
    }
    else if (platform === "LINKEDIN") {
      const { accessToken } = credentials;
      let response;
      try {
        response = await axios.get("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      } catch (err) {
        response = await axios.get("https://api.linkedin.com/v2/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "LinkedIn-Version": "202401",
            "X-Restli-Protocol-Version": "2.0.0"
          }
        });
      }
      return res.json({ success: true, message: `Connected to LinkedIn user: ${response.data.name || response.data.localizedFirstName || "User"}` });
    }
    else if (platform === "TWITTER") {
      const { apiKey, apiSecret, accessToken, accessTokenSecret } = credentials;
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessTokenSecret
      });
      const user = await client.v2.me();
      return res.json({ success: true, message: `Connected to X (Twitter) user: @${user.data.username}` });
    }
    else if (platform === "THREADS") {
      const { accessToken } = credentials;
      if (!accessToken) {
        return res.status(400).json({ success: false, error: "Access Token is required" });
      }
      const response = await axios.get(
        `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken}`
      );
      return res.json({ success: true, message: `Connected to Threads user: @${response.data.username || response.data.id}` });
    }
    else if (platform === "YOUTUBE") {
      const { accessToken, channelId } = credentials;
      if (!accessToken || !channelId) {
        return res.status(400).json({ success: false, error: "Access Token and Channel ID are required" });
      }
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.data.items || response.data.items.length === 0) {
        return res.status(400).json({ success: false, error: "YouTube Channel not found or access token invalid" });
      }
      const channelName = response.data.items[0].snippet.title || "YouTube Channel";
      return res.json({ success: true, message: `Connected to YouTube channel: ${channelName}` });
    }
    res.status(400).json({ success: false, error: "Unsupported platform" });
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || err.message || "Connection failed";
    res.status(400).json({ success: false, error: msg });
  }
});

export { router as socialRouter };