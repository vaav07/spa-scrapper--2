const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const XLSX = require("xlsx");

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

async function scrapeExhibitorDetails(page, url) {
  await page.goto(url, { waitUntil: "networkidle0" });

  // Extract relevant details
  const details = await page.evaluate(() => {
    const getText = (selector) =>
      document.querySelector(selector)?.textContent.trim() || "";
    const getHref = (selector) =>
      document.querySelector(selector)?.getAttribute("href") || "";

    const name = getText(".headline-title strong span");
    const country = getText(".location-info div:last-child")
      .split("\n")
      .pop()
      .trim(); // Gets the country, assuming it's the last line in the address
    const email = getText(".ico_email a span");
    const website = getHref(".ico_link a");
    const phone = getText(".ico_phone");
    // const fax = getText(".ico_fax");
    // const address =
    //   document
    //     .querySelector(".location-info div")
    //     ?.innerHTML.replace(/<br>/g, ", ")
    //     .trim() || "N/A";

    const rawAddress = document
      .querySelector(".location-info div:last-child")
      .innerHTML.replace(/<br\s*\/?>/gi, ", ") // Replace <br> with commas
      .replace(/\s+/g, " ") // Replace multiple spaces with a single space
      .replace(/,\s*,/g, ", ") // Handle redundant commas
      .trim(); // Trim leading/trailing whitespace

    const address = rawAddress.replace(/,\s*$/, "");
    const hall = getText(".asdb54-hallen-bubble .texts strong:nth-child(1)");
    const booth = getText(".asdb54-hallen-bubble .texts b");

    return {
      name,
      contactPerson: "",
      designation: "",
      country,
      email,
      website,
      phone: "'" + phone,
      // fax,
      mobile: "",
      address,
      hall,
      booth,
    };
  });

  return details;
}

// (async () => {
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();

//   const url = "https://www.ism-cologne.com/exhibitor/family_wm_gmbh/"; // replace with the actual detail page URL
//   const exhibitorDetails = await scrapeExhibitorDetails(page, url);

//   console.log(exhibitorDetails);

//   await browser.close();
// })();

async function saveToExcel(data, filename) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Exhibitors");

  XLSX.writeFile(workbook, filename);
  console.log(`Data successfully saved to ${filename}`);
}

async function main() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Log in first
    await page.goto("https://www.ism-cologne.com/", {
      waitUntil: "networkidle0",
    });
    await navigateToLoginPage(page);
    await login(page, "v071997@gmail.com", "5Huf+&YGp@JP&zF");

    // Read the JSON file containing the links
    // const linksData = await fs.readFile("exhibitors_data.json", "utf8");
    const linksData = await fs.readFile("limited-data.json", "utf8");
    const links = JSON.parse(linksData);

    const exhibitors = [];
    for (const link of links) {
      console.log(`Scraping: ${link}`);
      const details = await scrapeExhibitorDetails(page, link);
      exhibitors.push(details);

      await new Promise((resolve) => setTimeout(resolve, 6000)); // Give some time for the next page to load
    }

    // Save scraped data to Excel
    await saveToExcel(exhibitors, "exhibitors_data.xlsx");
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await browser.close();
  }
}

main();
