import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import userRoutes from "./routes/userRoutes";
import petRoutes from "./routes/petRoutes";
import businessRoutes from "./routes/businessRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import activityRoutes from "./routes/activityRoutes";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => res.send("Pet Management API running 🚀"));

app.use("/users", userRoutes);
app.use("/pets", petRoutes);
app.use("/businesses", businessRoutes);
app.use("/upload", uploadRoutes);
app.use("/activities", activityRoutes);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(errorHandler);

export default app;
