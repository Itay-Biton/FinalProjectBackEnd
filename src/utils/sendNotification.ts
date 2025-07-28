// src/utils/sendNotification.ts
import admin from "../config/firebase";
import User from "../models/User";

interface NotificationInput {
  userId: string;
  message: string;
  title?: string;
  matchPetId?: string;
}

export default async function sendNotification({
  userId,
  message,
  title = "MyPet Alert",
  matchPetId,
}: NotificationInput) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) {
      console.warn(`⚠️ No FCM token for user ${userId}`);
      return;
    }

    const payload = {
      notification: {
        title,
        body: message,
      },
      data: {
        matchPetId: matchPetId || "",
      },
      token: user.fcmToken,
    };

    const response = await admin.messaging().send(payload);
    console.log(`✅ Notification sent to ${user.email}: ${response}`);
  } catch (err) {
    console.error(`❌ Failed to send notification to user ${userId}`, err);
  }
}
