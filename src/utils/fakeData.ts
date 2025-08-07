import User from "../models/User";
import Pet from "../models/Pet";
import Business from "../models/Business";
import Review from "../models/Review";
import ActivityEntry from "../models/ActivityEntry";

// Pet-related data - matching frontend constants
const petSpecies = [
  "dog",
  "cat",
  "bird",
  "ferret",
  "fish",
  "rabbit",
  "horse",
  "other",
];
const dogBreeds = [
  "Labrador Retriever",
  "German Shepherd",
  "Golden Retriever",
  "Bulldog",
  "Beagle",
  "Poodle",
  "Rottweiler",
  "Yorkshire Terrier",
  "Boxer",
  "Dachshund",
];
const catBreeds = [
  "Persian",
  "Maine Coon",
  "Siamese",
  "Ragdoll",
  "British Shorthair",
  "Abyssinian",
  "Russian Blue",
  "Sphynx",
  "Bengal",
  "Scottish Fold",
];
const petColors = ["black", "white", "brown", "golden", "grey"];

// Business service types - matching frontend constants
const businessServiceTypes = [
  "veterinarian",
  "grooming",
  "pet_sitting",
  "pet_boarding",
  "pet_supplies",
  "pet_training",
  "pet_walking",
  "pet_photography",
  "other_service",
];

// Activity types - matching frontend constants
const activityTypes = [
  "feeding",
  "medication",
  "exercise",
  "grooming",
  "play",
  "health",
  "other",
];

// Helper functions for random data generation
function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, precision: number = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(precision));
}

function randomBoolean(probability: number = 0.5): boolean {
  return Math.random() < probability;
}

function randomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomPhone(): string {
  return `05${randomInt(0, 9)}-${randomInt(100, 999)}-${randomInt(1000, 9999)}`;
}

function randomEmail(firstName: string, lastName: string): string {
  const domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${randomElement(
    domains
  )}`;
}

function randomImageUrl(): string {
  const categories = ["animals", "nature", "people", "business"];
  const category = randomElement(categories);
  return `https://picsum.photos/400/300?random=${randomInt(1, 1000)}`;
}

function randomAddress(city: string): string {
  const streets = [
    "Main St",
    "Oak Ave",
    "Pine Rd",
    "Elm St",
    "Cedar Ln",
    "Maple Dr",
  ];
  const street = randomElement(streets);
  const number = randomInt(1, 999);
  return `${number} ${street}, ${city}`;
}

function randomDate(pastYears: number = 5): Date {
  const now = new Date();
  const past = new Date(now.getTime() - pastYears * 365 * 24 * 60 * 60 * 1000);
  return new Date(
    past.getTime() + Math.random() * (now.getTime() - past.getTime())
  );
}

function randomParagraph(): string {
  const sentences = [
    "This is a sample description for testing purposes.",
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
    "The quick brown fox jumps over the lazy dog.",
    "All work and no play makes Jack a dull boy.",
    "A journey of a thousand miles begins with a single step.",
    "Practice makes perfect.",
  ];
  return randomElement(sentences);
}

// Israeli cities and coordinates
const israeliCities = [
  { name: "Tel Aviv", coordinates: [34.7818, 32.0853] },
  { name: "Jerusalem", coordinates: [35.2137, 31.7683] },
  { name: "Haifa", coordinates: [34.9896, 32.794] },
  { name: "Rishon LeZion", coordinates: [34.8044, 31.9545] },
  { name: "Petah Tikva", coordinates: [34.8726, 32.084] },
  { name: "Ashdod", coordinates: [34.65, 31.8] },
  { name: "Netanya", coordinates: [34.8599, 32.3328] },
  { name: "Beer Sheva", coordinates: [34.797, 31.2518] },
  { name: "Holon", coordinates: [34.779, 32.0167] },
  { name: "Bnei Brak", coordinates: [34.8333, 32.0833] },
];

// Generate random coordinates within a city
function getRandomCoordinates(cityCoords: number[]) {
  const latOffset = (Math.random() - 0.5) * 0.01; // ±0.005 degrees
  const lngOffset = (Math.random() - 0.5) * 0.01;
  return [cityCoords[0] + lngOffset, cityCoords[1] + latOffset];
}

// Generate random working hours
function generateWorkingHours() {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return days.map((day) => ({
    day,
    isOpen: day !== "Sunday", // Most businesses closed on Sunday in Israel
    openTime: day === "Sunday" ? "" : `${8 + Math.floor(Math.random() * 2)}:00`,
    closeTime:
      day === "Sunday" ? "" : `${18 + Math.floor(Math.random() * 3)}:00`,
  }));
}

// Generate health history for pets
function generateHealthHistory() {
  const events = [
    "Vaccination",
    "Checkup",
    "Dental cleaning",
    "Surgery",
    "Medication",
    "Blood test",
    "X-ray",
    "Microchip implant",
    "Spay/Neuter",
    "Emergency visit",
  ];

  const count = randomInt(1, 5);
  const history = [];

  for (let i = 0; i < count; i++) {
    const date = randomDate(2);
    history.push({
      date: date.toLocaleDateString("en-GB"),
      event: randomElement(events),
      details: randomParagraph(),
    });
  }

  return history;
}

// Generate activity entries for pets
function generateActivityEntries(ownerId: string, petId: string) {
  const entries = [];
  const daysBack = 30;

  for (let i = 0; i < daysBack; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // Generate 1-3 activities per day
    const activitiesPerDay = Math.floor(Math.random() * 3) + 1;

    for (let j = 0; j < activitiesPerDay; j++) {
      const activityType = randomElement(activityTypes);
      let description = "";
      let quantity = "";
      let duration = "";

      switch (activityType) {
        case "feeding":
          description = `Fed ${randomElement([
            "dry food",
            "wet food",
            "homemade food",
          ])}`;
          quantity = randomElement(["1 cup", "2 cups", "1/2 cup", "1 can"]);
          break;
        case "medication":
          description = `Administered ${randomElement([
            "vitamins",
            "flea treatment",
            "heart medication",
            "pain medication",
          ])}`;
          quantity = randomElement(["1 pill", "2 pills", "1 ml", "2 ml"]);
          break;
        case "exercise":
          description = randomElement([
            "Walk in the park",
            "Play in the garden",
            "Training session",
            "Fetch game",
          ]);
          duration = randomElement(["30 min", "45 min", "1 hour", "20 min"]);
          break;
        case "grooming":
          description = randomElement([
            "Brushing",
            "Bath",
            "Nail trim",
            "Ear cleaning",
          ]);
          duration = randomElement(["15 min", "30 min", "45 min"]);
          break;
        case "play":
          description = randomElement([
            "Toy play",
            "Interactive games",
            "Fetch",
            "Tug of war",
          ]);
          duration = randomElement(["15 min", "30 min", "45 min", "1 hour"]);
          break;
        case "health":
          description = randomElement([
            "Vet checkup",
            "Vaccination",
            "Dental cleaning",
            "Health monitoring",
          ]);
          duration = randomElement(["30 min", "1 hour", "2 hours"]);
          break;
        case "other":
          description = randomElement([
            "Special care",
            "Custom activity",
            "Training session",
            "Socialization",
          ]);
          duration = randomElement(["15 min", "30 min", "45 min", "1 hour"]);
          break;
        default:
          description = `${activityType} session`;
          duration = randomElement(["15 min", "30 min", "45 min", "1 hour"]);
      }

      entries.push({
        ownerId,
        petId,
        date: date.toLocaleDateString("en-GB"),
        time: `${randomInt(6, 22)}:${randomElement(["00", "15", "30", "45"])}`,
        activityType,
        description,
        notes: Math.random() > 0.7 ? randomParagraph() : "",
        quantity: quantity || undefined,
        duration: duration || undefined,
      });
    }
  }

  return entries;
}

export async function generateFakeData() {
  console.log("🚀 Starting fake data generation...");

  try {
    // Clear existing data
    await User.deleteMany({});
    await Pet.deleteMany({});
    await Business.deleteMany({});
    await Review.deleteMany({});
    await ActivityEntry.deleteMany({});

    console.log("🗑️ Cleared existing data");

    // Generate Users
    const users = [];
    const userCount = 50;

    for (let i = 0; i < userCount; i++) {
      const firstName = `User${i + 1}`;
      const lastName = `Last${i + 1}`;
      const email = randomEmail(firstName, lastName);

      const user = new User({
        firebaseUid: randomString(28),
        firstName,
        lastName,
        email,
        phoneNumber: randomPhone(),
        profileImage: randomImageUrl(),
        role: randomElement(["user", "business_owner", "admin"]),
        preferences: {
          language: randomElement(["en", "he"]),
          notifications: randomBoolean(),
          locationSharing: randomBoolean(),
        },
        isActive: randomBoolean(0.9), // 90% active
        fcmToken: randomString(150),
      });

      users.push(await user.save());
    }

    console.log(`👥 Generated ${users.length} users`);

    // Generate Pets
    const pets = [];
    const petCount = 80;

    for (let i = 0; i < petCount; i++) {
      const owner = randomElement(users);
      const species = randomElement(petSpecies);
      let breed = "";

      if (species === "dog") {
        breed = randomElement(dogBreeds);
      } else if (species === "cat") {
        breed = randomElement(catBreeds);
      } else {
        breed = randomElement(["Mixed", "Purebred", "Unknown"]);
      }

      const city = randomElement(israeliCities);
      const coordinates = getRandomCoordinates(city.coordinates);

      const pet = new Pet({
        ownerId: owner._id,
        name: `Pet${i + 1}`,
        species,
        breed,
        age: `${randomInt(1, 15)} years`,
        birthday: randomDate(15),
        furColor: randomElement(petColors),
        eyeColor: randomElement(["blue", "green", "brown", "hazel", "grey"]),
        weight: {
          value: randomFloat(1, 50, 1),
          unit: species === "dog" ? "kg" : species === "cat" ? "kg" : "g",
        },
        images: Array.from({ length: randomInt(1, 4) }, () => randomImageUrl()),
        description: randomParagraph(),
        isLost: randomBoolean(0.1),
        isFound: false,
        phoneNumbers: [randomPhone()],
        location: {
          address: randomAddress(city.name),
          coordinates: {
            type: "Point",
            coordinates,
          },
        },
        distance: `${randomInt(1, 20)} km`,
        vaccinated: randomBoolean(0.8),
        microchipped: randomBoolean(0.6),
      });

      pets.push(await pet.save());
    }

    console.log(`🐾 Generated ${pets.length} pets`);

    // Generate Businesses
    const businesses = [];
    const businessCount = 30;

    for (let i = 0; i < businessCount; i++) {
      const owner = randomElement(
        users.filter((u) => u.role === "business_owner")
      );
      const serviceType = randomElement(businessServiceTypes);
      const city = randomElement(israeliCities);
      const coordinates = getRandomCoordinates(city.coordinates);

      const business = new Business({
        ownerId: owner._id,
        name: `${serviceType} Business ${i + 1}`,
        serviceType,
        rating: randomFloat(1, 5, 1),
        reviewCount: randomInt(0, 100),
        email: randomEmail(`Business${i + 1}`, "Owner"),
        phoneNumbers: [randomPhone()],
        location: {
          address: randomAddress(city.name),
          coordinates: {
            type: "Point",
            coordinates,
          },
        },
        distance: `${randomInt(1, 15)} km`,
        workingHours: generateWorkingHours(),
        images: Array.from({ length: randomInt(1, 5) }, () => randomImageUrl()),
        description: randomParagraph() + " " + randomParagraph(),
        services: Array.from(
          { length: randomInt(3, 8) },
          () => `Service ${randomInt(1, 10)}`
        ),
        isOpen: randomBoolean(0.8),
        isVerified: randomBoolean(0.7),
      });

      businesses.push(await business.save());
    }

    console.log(`🏢 Generated ${businesses.length} businesses`);

    // Generate Reviews
    const reviews = [];
    const reviewCount = 100;

    for (let i = 0; i < reviewCount; i++) {
      const business = randomElement(businesses);
      const user = randomElement(users);

      const review = new Review({
        businessId: business._id,
        userId: user._id,
        rating: randomInt(1, 5),
        comment: randomParagraph(),
      });

      reviews.push(await review.save());
    }

    console.log(`⭐ Generated ${reviews.length} reviews`);

    // Generate Activity Entries
    const activityEntries = [];

    for (const pet of pets) {
      const entries = generateActivityEntries(
        pet.ownerId.toString(),
        pet._id.toString()
      );
      for (const entry of entries) {
        const activityEntry = new ActivityEntry(entry);
        activityEntries.push(await activityEntry.save());
      }
    }

    console.log(`📝 Generated ${activityEntries.length} activity entries`);

    console.log("✅ Fake data generation completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Pets: ${pets.length}`);
    console.log(`   - Businesses: ${businesses.length}`);
    console.log(`   - Reviews: ${reviews.length}`);
    console.log(`   - Activity Entries: ${activityEntries.length}`);
  } catch (error) {
    console.error("❌ Error generating fake data:", error);
    throw error;
  }
}

generateFakeData();
