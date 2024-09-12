const puppeteer = require("puppeteer");
const fs = require("fs").promises;

async function navigateToLoginPage(page) {
  // Wait for the specific login button to be available
  await page.waitForSelector("#cdcLoginButton");

  // Click the login button
  await page.evaluate(() => {
    const loginButton = document.querySelector("#cdcLoginButton");
    if (loginButton) {
      loginButton.click();
    } else {
      throw new Error("Login button not found");
    }
  });

  // Wait for navigation to complete after clicking the login button
  await page.waitForNavigation({ waitUntil: "networkidle0" });
}

async function login(page, email, password) {
  // Wait for the login form to be available
  await page.waitForSelector("#loginEmail");
  await page.waitForSelector("#loginPassword");

  // Fill in the login form
  await page.type("#loginEmail", email);
  await page.type("#loginPassword", password);

  // Submit the form
  const submitButton = await page.waitForSelector('button[type="submit"]');
  await submitButton.click();

  // Wait for navigation to complete after login (redirects to homepage)
  await page.waitForNavigation({ waitUntil: "networkidle0" });
}

async function scrapeExhibitorList(page) {
  const exhibitors = [];

  while (true) {
    // Wait for the exhibitor items to load
    await page.waitForSelector(".col.col1ergebnis a.initial_noline", {
      timeout: 10000,
    });

    // Scrape the href attribute of each exhibitor link
    const newExhibitors = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".col.col1ergebnis a.initial_noline")
      ).map((el) => el.href);
    });

    exhibitors.push(...newExhibitors);

    // Check for the "next" button in pagination
    const nextButton = await page.$(".pagination-footer a.slick-next");
    if (nextButton) {
      await nextButton.click();
      await new Promise((resolve) => setTimeout(resolve, 6000)); // Give some time for the next page to load
    } else {
      break;
    }
  }

  return exhibitors;
}

async function saveToFile(data, filename) {
  try {
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`Data successfully saved to ${filename}`);
  } catch (error) {
    console.error("Error saving data to file:", error);
  }
}

async function main() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto("https://www.ism-cologne.com/", {
      waitUntil: "networkidle0",
    });
    await navigateToLoginPage(page);
    await login(page, "v071997@gmail.com", "5Huf+&YGp@JP&zF");
    // await navigateToExhibitorList(page);

    await page.goto(
      "https://www.ism-cologne.com/ism-cologne-exhibitors/list-of-exhibitors/",
      { waitUntil: "networkidle0" }
    );

    const exhibitors = await scrapeExhibitorList(page);

    console.log(`Total exhibitors scraped: ${exhibitors.length}`);

    // Save the scraped data to a file
    await saveToFile(exhibitors, "exhibitors_data.json");
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await browser.close();
  }
}

main();
