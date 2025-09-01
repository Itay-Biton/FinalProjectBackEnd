import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectMongo } from "./config/mongo";

const PORT = Number(process.env.PORT || 3000);

(async () => {
  await connectMongo();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);

    // 🌱 Seed AFTER the server starts, only if enabled
    if (process.env.SEED_ON_STARTUP === "true") {
      (async () => {
        try {
          console.log("🌱 Seeding enabled (SEED_ON_STARTUP=true)");

          // Only import the generator when needed
          const { generateFakeData } = await import(
            "./utils/fakeDataGenerator"
          );

          // Skip reseeding if there is already data (unless forced)
          if (process.env.SEED_FORCE_RESET === "true") {
            console.log("⚠️ SEED_FORCE_RESET=true — wiping and reseeding…");
            await generateFakeData();
          } else {
            const { default: Pet } = await import("./models/Pet");
            const count = await Pet.countDocuments({});
            if (count > 0) {
              console.log(
                `🌱 Skipping seeding: existing Pet count = ${count}. Set SEED_FORCE_RESET=true to wipe & reseed.`
              );
            } else {
              await generateFakeData();
            }
          }

          console.log("🌱 Seeding complete.");
        } catch (err) {
          console.error("❌ Seeding failed:", err);
        }
      })();
    }
  });

  // graceful shutdown (optional)
  process.on("SIGTERM", () => {
    console.log("Received SIGTERM, shutting down server…");
    server.close(() => process.exit(0));
  });
})();
