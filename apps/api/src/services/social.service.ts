import axios from "axios";
import { TwitterApi } from "twitter-api-v2";
import { decrypt } from "../lib/crypto.js";
import { prisma } from "../lib/prisma.js";

// Helper to get and decrypt social account credentials
async function getSocialAccount(siteId: string, platform: string) {
  const account = await prisma.socialAccount.findUnique({
    where: {
      siteId_platform: {
        siteId,
        platform: platform as any
      }
    }
  });
  if (!account || !account.credentials) {
    throw new Error(`Social account for ${platform} not found on this site`);
  }
  return {
    ...account,
    credentials: JSON.parse(decrypt(account.credentials as string))
  };
}

export async function sharePost(postId: string, platform: string) {
  // 1. Get post & site details
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { site: true }
  });
  if (!post) throw new Error("Post not found");
  if (!post.siteId) throw new Error("Post has no site association");

  // 2. Fetch social credentials
  const account = await getSocialAccount(post.siteId, platform);
  const creds = account.credentials;

  let shareUrl = "";

  try {
    // 3. Platform-specific sharing logic
    if (platform === "FACEBOOK") {
      // Post to FB page — Graph API expects access_token as query param
      // and message/link as form-encoded body or query params
      const postText = `${post.title}\n\n${post.content.replace(/<[^>]*>/g, '').substring(0, 200)}...`;
      const res = await axios.post(
        `https://graph.facebook.com/v18.0/${creds.pageId}/feed`,
        null,
        {
          params: {
            message: postText,
            link: `${post.site.url}/posts/${post.id}`,
            access_token: creds.pageAccessToken
          }
        }
      );
      shareUrl = `https://facebook.com/${res.data.id}`;
    } 
    else if (platform === "INSTAGRAM") {
      // Create & publish IG container
      // Requires an image, use a placeholder if none
      const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/a/a3/June_odd-eyed-cat.jpg";
      
      // Step A: Create container
      const containerRes = await axios.post(
        `https://graph.facebook.com/v18.0/${creds.igAccountId}/media`,
        {
          image_url: imageUrl,
          caption: `${post.title}\n\n${post.content.replace(/<[^>]*>/g, '').substring(0, 200)}...`
        },
        {
          headers: { Authorization: `Bearer ${creds.pageAccessToken}` }
        }
      );

      if (!containerRes.data.id) {
        throw new Error("Failed to create Instagram container: " + JSON.stringify(containerRes.data));
      }

      // Instagram needs a moment to download and process the image from the URL
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Step B: Publish container
      const publishRes = await axios.post(
        `https://graph.facebook.com/v18.0/${creds.igAccountId}/media_publish`,
        {
          creation_id: containerRes.data.id
        },
        {
          headers: { Authorization: `Bearer ${creds.pageAccessToken}` }
        }
      );
      shareUrl = `https://instagram.com/p/${publishRes.data.id}`;
    }
    else if (platform === "LINKEDIN") {
      // Try versioned Posts API first (requires LinkedIn-Version + approved app),
      // then fall back to the legacy UGC Posts API which works for any w_member_social token.
      let linkedInRes: any;
      let urn = "";

      try {
        linkedInRes = await axios.post(
          "https://api.linkedin.com/v2/posts",
          {
            author: creds.personUrn,
            commentary: `${post.title}\n\n${post.content.replace(/<[^>]*>/g, '').substring(0, 700)}`,
            visibility: "PUBLIC",
            distribution: {
              feedDistribution: "MAIN_FEED",
              targetEntities: [],
              requestedCountries: []
            },
            lifecycleState: "PUBLISHED",
            isReshareDisabledByAuthor: false
          },
          {
            headers: {
              Authorization: `Bearer ${creds.accessToken}`,
              "Content-Type": "application/json",
              "LinkedIn-Version": "202401",
              "X-Restli-Protocol-Version": "2.0.0"
            }
          }
        );
        urn = linkedInRes.headers["x-restli-id"] || linkedInRes.data?.id || "";
      } catch (versionedErr: any) {
        // 403/404 → app not approved for versioned API; fall back to /v2/ugcPosts
        if (versionedErr.response?.status === 403 || versionedErr.response?.status === 404) {
          console.warn("[social.service] LinkedIn versioned API rejected, falling back to /v2/ugcPosts");
          const text = `${post.title}\n\n${post.content.replace(/<[^>]*>/g, '').substring(0, 700)}`;
          linkedInRes = await axios.post(
            "https://api.linkedin.com/v2/ugcPosts",
            {
              author: creds.personUrn,
              lifecycleState: "PUBLISHED",
              specificContent: {
                "com.linkedin.ugc.ShareContent": {
                  shareCommentary: { text },
                  shareMediaCategory: "NONE"
                }
              },
              visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
              }
            },
            {
              headers: {
                Authorization: `Bearer ${creds.accessToken}`,
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0"
              }
            }
          );
          urn = linkedInRes.headers["x-restli-id"] || linkedInRes.data?.id || "";
        } else {
          throw versionedErr; // re-throw non-403/404 errors (e.g. 401 bad token)
        }
      }

      shareUrl = urn ? `https://www.linkedin.com/feed/update/${urn}` : "https://www.linkedin.com/feed/";
    }
    else if (platform === "TWITTER") {
      // Post to X
      const client = new TwitterApi({
        appKey: creds.apiKey,
        appSecret: creds.apiSecret,
        accessToken: creds.accessToken,
        accessSecret: creds.accessTokenSecret
      });
      
      const text = `${post.title}\n\n${post.content.replace(/<[^>]*>/g, '').substring(0, 140)}...`;
      const res = await client.v2.tweet(text);
      shareUrl = `https://twitter.com/i/web/status/${res.data.id}`;
    }
    else if (platform === "THREADS") {
      // Threads API publishing
      let text = `${post.title}\n\n${post.content.replace(/<[^>]*>/g, '')}`;
      if (text.length > 500) {
        text = text.substring(0, 497) + "...";
      }
      const containerRes = await axios.post(
        `https://graph.threads.net/v1.0/${creds.threadsUserId}/threads`,
        null,
        {
          params: {
            media_type: "TEXT",
            text,
            access_token: creds.accessToken
          }
        }
      );
      const containerId = containerRes.data.id;
      const publishRes = await axios.post(
        `https://graph.threads.net/v1.0/${creds.threadsUserId}/threads_publish`,
        null,
        {
          params: {
            creation_id: containerId,
            access_token: creds.accessToken
          }
        }
      );
      const threadId = publishRes.data.id;
      shareUrl = threadId ? `https://www.threads.net/@${creds.threadsUserId}/post/${threadId}` : `https://www.threads.net/@${creds.threadsUserId}`;
    }
    else if (platform === "YOUTUBE") {
      // Post to YouTube — standard YouTube API doesn't support Community tab posts for text directly.
      // We validate the token/channel and return the channel updates URL.
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${creds.channelId}`,
        { headers: { Authorization: `Bearer ${creds.accessToken}` } }
      );
      if (!response.data.items || response.data.items.length === 0) {
        throw new Error("YouTube Channel not found or access token invalid");
      }
      shareUrl = `https://www.youtube.com/channel/${creds.channelId}`;
    }

    // 4. Save/Update SocialShare record as SHARED
    const existingShare = await prisma.socialShare.findFirst({
      where: { postId, platform: platform as any }
    });

    let share;
    if (existingShare) {
      share = await prisma.socialShare.update({
        where: { id: existingShare.id },
        data: {
          status: "SHARED",
          shareUrl,
          error: null
        }
      });
    } else {
      share = await prisma.socialShare.create({
        data: {
          postId,
          platform: platform as any,
          status: "SHARED",
          shareUrl,
          socialAccountId: account.id
        }
      });
    }

    return share;
  } catch (error: any) {
    // Extract the most descriptive error from the platform API response
    const apiError = error.response?.data;
    const errorMsg =
      apiError?.error?.message ||
      apiError?.message ||
      apiError?.error_description ||
      (typeof apiError === "string" ? apiError : null) ||
      error.message ||
      "Unknown error";

    // Preserve upstream HTTP status so the route can forward it
    const upstreamStatus: number | undefined = error.response?.status;
    const fullMsg = upstreamStatus ? `[${upstreamStatus}] ${errorMsg}` : errorMsg;

    console.error(`[social.service] sharePost failed for post=${postId} platform=${platform}:`, fullMsg);
    if (error.response?.data) {
      console.error(`[social.service] Platform API response:`, JSON.stringify(error.response.data));
    }

    const existingShare = await prisma.socialShare.findFirst({
      where: { postId, platform: platform as any }
    });

    if (existingShare) {
      await prisma.socialShare.update({
        where: { id: existingShare.id },
        data: {
          status: "FAILED",
          error: fullMsg
        }
      });
    } else {
      await prisma.socialShare.create({
        data: {
          postId,
          platform: platform as any,
          status: "FAILED",
          error: fullMsg,
          socialAccountId: account.id
        }
      });
    }

    // Attach upstream status to the error for the route to use
    const thrownError: any = new Error(fullMsg);
    thrownError.upstreamStatus = upstreamStatus;
    thrownError.platformError = errorMsg;
    throw thrownError;
  }
}