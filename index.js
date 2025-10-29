import express from "express";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Ambil token bot dan API key dari .env
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const VEO_API_URL =
  process.env.VEO_API_URL ||
  "https://generativelanguage.googleapis.com/v1beta/openai/generations";
const VEO_API_KEY = process.env.VEO_API_KEY;

if (!TELEGRAM_BOT_TOKEN) {
  console.error("❌ Missing TELEGRAM_BOT_TOKEN in .env");
  process.exit(1);
}

// Inisialisasi bot Telegram
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Tombol aspek rasio
function sendAspectButtons(chatId) {
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📱 9:16 (Vertical)", callback_data: "aspect_9_16" },
          { text: "🖥️ 16:9 (Horizontal)", callback_data: "aspect_16_9" },
        ],
      ],
    },
  };
  bot.sendMessage(chatId, "Pilih aspek rasio video Veo3:", opts);
}

// Command /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Selamat datang di *Veodeonfixbot*!\n\nPilih aspek rasio video yang ingin kamu buat:",
    { parse_mode: "Markdown" }
  );
  sendAspectButtons(msg.chat.id);
});

const userState = {};

// Callback tombol aspek
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  const aspect = data === "aspect_16_9" ? "16:9" : "9:16";
  userState[chatId] = { aspect, waitingPrompt: true };

  bot.sendMessage(
    chatId,
    `✅ Aspek rasio dipilih: *${aspect}*\nSekarang kirim deskripsi video kamu.`,
    { parse_mode: "Markdown" }
  );
});

// Saat user kirim prompt
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const state = userState[chatId];

  // Abaikan jika belum pilih aspek atau ini command
  if (!state || msg.text.startsWith("/")) return;

  if (state.waitingPrompt) {
    const prompt = msg.text;
    state.waitingPrompt = false;

    bot.sendMessage(chatId, "🎬 Membuat video 8 detik multi-scene...");

    // Payload contoh untuk Veo API
    const body = {
      model: "gemini-1.5-flash",
      prompt: {
        text: `Buat video AI berdurasi 8 detik dengan aspek rasio ${state.aspect}, tema: ${prompt}. Format multi-scene.`,
      },
    };

    try {
      const response = await axios.post(`${VEO_API_URL}?key=${VEO_API_KEY}`, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 120000,
      });

      // Ambil URL video dari respons API
      const videoUrl = response.data?.video_url || response.data?.result?.url;

      if (videoUrl) {
        bot.sendVideo(chatId, videoUrl, { caption: "✅ Video selesai dibuat!" });
      } else {
        bot.sendMessage(
          chatId,
          "⚠️ API berhasil dipanggil tapi tidak ada URL video di respons.\nCoba periksa format API Veo."
        );
        console.log("Response API:", JSON.stringify(response.data, null, 2));
      }
    } catch (err) {
      console.error("Error API:", err.response?.data || err.message);
      bot.sendMessage(
        chatId,
        "❌ Gagal membuat video. Periksa API key, format, atau log Railway."
      );
    }
  }
});

// Endpoint untuk Railway (health check)
app.get("/", (req, res) => res.send("🤖 Veodeonfixbot is running on Railway."));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
