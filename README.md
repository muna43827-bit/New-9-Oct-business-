# LOCAL BUSINESS DIGITAL KIT GENERATOR

A production-quality, mobile-first web application designed to generate complete digital marketing kits for local businesses (salons, restaurants, cafes, gyms, boutiques, shops, coaching centres, clinics, repair services, and more).

## ⚡ Core Features

1. **Dashboard:**
   - Real-time statistics: Total Businesses, Completed Kits, In-Progress Drafts, Digital Assets.
   - Quick action to create new businesses or reload the pre-seeded "Royal Cuts Salon" demo.
   - Saved business cards with quick actions: Edit, Preview, Kit, Duplicate, Export, Delete.

2. **Multi-Step Business Details Form:**
   - **Step 1:** Business Name (required), Category, Owner Name, Calling Phone, WhatsApp Number, Email, Street Address, City, State, PIN Code.
   - **Step 2:** Opening Hours, Weekly Working Days, Tagline, Business Description.
   - **Step 3:** Google Maps Link, Google Business Profile / Review Link, Instagram, Facebook, YouTube, Website.

3. **Services & Dynamic Pricing Manager:**
   - Unlimited services and products.
   - Categories (Salon, Restaurant, Gym, Custom categories).
   - Real price and old price (automatic discount percentage calculation).
   - Add, edit, delete, duplicate, and filter services.

4. **Photos & Logo Suite:**
   - Upload Logo, Cover/Banner Photo, and Gallery/Product Photos.
   - Built-in canvas compression to protect `localStorage` from exceeding browser quotas.
   - Individual photo deletion and replacement.

5. **Automatic Digital Business Card:**
   - Tap-to-Call (`tel:`), Direct WhatsApp (`wa.me`), Google Maps Directions, Instagram, Services, and Reviews.
   - **Save Contact (vCard .vcf):** Generates and downloads real vCard 3.0 files for immediate saving into smartphone address books.
   - Standalone card HTML export and share link trigger.

6. **Customer-Ready Digital Catalogue:**
   - Categorized service menu with pricing and discounts.
   - WhatsApp Enquiry button pre-filled with the exact service name and price.
   - Print-friendly layout for physical menu printing.

7. **In-Browser QR Code Engine (Zero External Dependencies):**
   - 100% offline, pure JavaScript QR code generator.
   - Targets: WhatsApp, Calling Phone, Google Maps, Digital Catalogue, Google Reviews, Instagram, Custom URL.
   - Customizable foreground and background colors.
   - High-definition PNG download (1000x1000px).
   - **Printable Review Standee Tent Card:** "HOW WAS YOUR EXPERIENCE? Scan to leave your feedback... Thank you for visiting us!"

8. **Promotional Post Creative Generator:**
   - HTML Canvas generator supporting 10 templates (SPECIAL OFFER, NEW ARRIVAL, BOOK NOW, LIMITED OFFER, WEEKEND SPECIAL, NEW COLLECTION, TODAY'S SPECIAL, CONTACT US, VISIT US, THANK YOU).
   - 3 aspect ratios: Square 1:1 (Post/DP), Portrait 4:5 (Instagram Feed), Story 9:16 (Reels/Status).
   - 4 color themes: Luxury Dark & Gold, Royal Sapphire Blue, Fresh Emerald Green, Warm Sunset Coral.
   - Instant high-res PNG download.

9. **Complete Business Kit Generator & Deliverable Report:**
   - Step-by-step assembly animation.
   - Executive deliverable report: "BUSINESS DIGITAL KIT - READY TO DELIVER" with checklist.
   - Printable documentation sheet.

10. **Realistic Mobile Phone Preview:**
    - Smartphone mockup with bezel, notch, status bar, and time indicator.
    - Interactive tab bar (Home, Services, Catalogue, Contact, Reviews) using live business data.

11. **Export & Download Suite:**
    - Standalone single-file customer website (`index.html`) that works anywhere without servers.
    - Standalone Digital Card HTML & PNG.
    - Standalone Digital Catalogue HTML & Print PDF.
    - Review QR Standee PNG & Print.
    - Promotional Post PNGs.
    - Export single business JSON / Export all businesses JSON backup.
    - Restore / Import JSON.

---

## 🚀 GitHub Pages Deployment Guide

This project is 100% static and runs entirely in the browser using HTML5, CSS3, and vanilla JavaScript. No Node.js, PHP, Python, or external databases are required.

### Deploying This Generator Suite:
1. Create a repository on [GitHub](https://github.com) named `digital-kit-generator`.
2. Push or upload the following files into the root of the repository:
   - `index.html`
   - `style.css`
   - `script.js`
3. Navigate to **Repository Settings** > **Pages**.
4. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main** (or **master**)
   - Folder: **/ (root)**
5. Click **Save**. Your generator will be live at `https://<your-username>.github.io/digital-kit-generator/`.

### Deploying a Customer's Generated Website:
1. Open the generator and select the customer's business.
2. Go to **Export & Download Suite** (or click **Download Kit** in the Kit Generator).
3. Click **"Download Standalone Website (HTML)"**.
4. Rename the downloaded file to `index.html`.
5. Create a GitHub repository for the business (e.g., `royal-cuts-salon`).
6. Upload the `index.html` file to the root of that repository.
7. Go to **Settings** > **Pages** > Select branch **main** > Click **Save**.
8. The customer's mobile-friendly digital kit website is live with free HTTPS SSL in 60 seconds!
