import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectMongo } from "./config/mongo";

const PORT = process.env.PORT || 3000;

(async () => {
  await connectMongo();
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
})();
