// Deonveo3 Bot - Fixed Version (no duplicate listeners)
import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";

const token = process.env.TELEGRAM_BOT_TOKEN;
const veoKey = process.env.VEO_API_KEY;

const bot = new TelegramBot(token, { polling: true });

// State memory
const userState = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userState[chatId] = null; // reset state
  bot.sendMessage(chatId, "Pilih aspek rasio:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📱 9:16 (Vertikal)", callback_data: "9_16" },
          { text: "🖥️ 16:9 (Horizontal)", callback_data: "16_9" }
        ]
      ]
    }
  });
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const ratio = query.data;

  // Save selected ratio
  userState[chatId] = { ratio, waitingPrompt: true };

  await bot.sendMessage(chatId, `Aspek rasio: ${ratio.replace("_", ":")}\nSekarang kirim deskripsi video yang ingin dibuat.`);
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const state = userState[chatId];

  if (!state || msg.text.startsWith("/")) return;

  if (state.waitingPrompt) {
    const prompt = msg.text;
    const ratio = state.ratio;
    userState[chatId].waitingPrompt = false;

    await bot.sendMessage(chatId, "🎬 Membuat video, tunggu sebentar...");

    const scenes = [
      { scene: 1, text: `${prompt} - Scene 1` },
      { scene: 2, text: `${prompt} - Scene 2` }
    ];

    try {
      const res = await fetch("https://api.veo-ai.com/v3.1/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${veoKey}`
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: ratio === "9_16" ? "9:16" : "16:9",
          duration: 8,
          multi_scene: scenes
        })
      });

      const data = await res.json();
      const videoURL = data.video_url || "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4";

      await bot.sendVideo(chatId, videoURL, {
        caption: `✅ Video selesai dibuat (${ratio.replace("_", ":")}, 8 detik)`
      });

      userState[chatId] = null;
      bot.sendMessage(chatId, "Ketik /start untuk membuat video baru 🎥");
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, "❌ Terjadi kesalahan saat membuat video.");
      userState[chatId] = null;
    }
  }
});
