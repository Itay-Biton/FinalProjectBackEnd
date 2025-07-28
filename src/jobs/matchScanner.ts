import cron from "node-cron";
import Pet from "../models/Pet";
import LostPet from "../models/LostPet";
import {
  computeMatchScore,
  PetLike,
  getGeoDistance,
} from "../utils/matchAlgorithm";
import sendNotification from "../utils/sendNotification";

const MATCH_THRESHOLD = 7;
const MAX_SEARCH_RADIUS_KM = 10; // Only consider found pets within this distance

async function scanForLostFoundMatches() {
  const lostPets = await LostPet.find({ status: "lost" }).populate("petId");
  const foundPets = await LostPet.find({ status: "found" }).populate("petId");

  for (const lost of lostPets) {
    const lostPet = lost.petId as PetLike;

    for (const found of foundPets) {
      const foundPet = found.petId as PetLike;

      // 1️⃣ Skip if location too far
      const distance = getGeoDistance(
        lostPet.location?.coordinates ?? [0, 0],
        foundPet.location?.coordinates ?? [0, 0]
      );

      if (distance > MAX_SEARCH_RADIUS_KM) continue;

      // 2️⃣ Compute score (use separate scoring radius if needed)
      const score = computeMatchScore(lostPet, foundPet);

      if (score >= MATCH_THRESHOLD) {
        console.log(
          `Match score ${score} between lost:${lostPet._id} and found:${foundPet._id}`
        );

        // Notify the reporter of the lost pet
        await sendNotification({
          userId: lost.reporterId.toString(),
          title: "Possible Match Found",
          message: `We may have found your lost pet! Match score: ${score}`,
          matchPetId: foundPet._id?.toString(),
        });
      }
    }
  }
}

// Cron: runs every hour
cron.schedule("0 * * * *", async () => {
  console.log("Running lost/found pet match scan...");
  await scanForLostFoundMatches();
});
