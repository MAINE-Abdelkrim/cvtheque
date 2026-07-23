import { v2 as cloudinary } from 'cloudinary';

// STEP 3: Configure Cloudinary using inline credentials
cloudinary.config({
  cloud_name: 's8c3eyfl',
  api_key: '476911859997558',
  api_secret: 'OmsTyxGmiHp6L40YOjUOOlOEhUI'
});

async function runOnboarding() {
  console.log("=== Cloudinary Onboarding Script ===");
  console.log("1. Uploading image to Cloudinary...");

  try {
    // A sample image URL from Cloudinary's demo domains
    const sampleImageUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

    // Uploading the image
    const uploadResult = await cloudinary.uploader.upload(sampleImageUrl, {
      folder: 'onboarding_demo'
    });

    console.log("\n[Success] Image uploaded successfully!");
    console.log(`- Secure URL: ${uploadResult.secure_url}`);
    console.log(`- Public ID: ${uploadResult.public_id}`);

    // STEP 3.3: Fetch and print image metadata
    console.log("\n2. Fetching image metadata details:");
    console.log(`- Width: ${uploadResult.width}px`);
    console.log(`- Height: ${uploadResult.height}px`);
    console.log(`- Format: ${uploadResult.format}`);
    console.log(`- File Size: ${uploadResult.bytes} bytes`);

    // STEP 3.4: Generate transformed version of the image URL
    // f_auto: Automatic format selection (delivers the best format based on user browser, e.g. WebP/AVIF)
    // q_auto: Automatic quality (compresses the image to optimize file size without visible loss)
    const transformedUrl = cloudinary.url(uploadResult.public_id, {
      secure: true,
      fetch_format: 'auto', // f_auto
      quality: 'auto'       // q_auto
    });

    console.log("\n3. Generating optimized transformation URL...");
    console.log("--------------------------------------------------------------------------------");
    console.log("Done! Click link below to see optimized version of the image. Check the size and the format.");
    console.log(`Optimized URL: ${transformedUrl}`);
    console.log("--------------------------------------------------------------------------------");

  } catch (error) {
    console.error("\n[Error] Cloudinary operation failed:", error);
    process.exit(1);
  }
}

runOnboarding();
