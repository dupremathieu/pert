# PERT
Estimation PERT builder working fully in local

## How to Install the npm version

### Prerequisites
You'll need to have Node.js (which includes npm) installed on your computer.

#### Step 1: Create a New React Project
It's best to use a modern build tool like Vite to set up the project. Open your terminal and run these commands:

1. **Create the project:**

```sh
npm create vite@latest pert-estimator-tool -- --template react
```
2. **Navigate into the project directory:**
```sh
cd pert-estimator-tool
```
#### Step 2: Install and Configure Tailwind CSS
The UI relies on Tailwind CSS for styling.

1. **Install Tailwind's dependencies:**
```sh
install -D tailwindcss postcss autoprefixer
```
2. **Generate the configuration files:**
```sh
npx tailwindcss init -p
```
This will create `tailwind.config.js` and `postcss.config.js`.
3. Configure Tailwind's template paths: Open the `tailwind.config.js` file and replace its content with the following to tell Tailwind which files to scan for classes:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```
#### Step 3: Install Additional Dependencies
The project uses the `lucide-react` library for icons.

1. **Install the library:**
```sh
npm install lucide-react
```

#### Step 4: Run the Application
Now you're ready to start the development server.

1. Run the start command:

```sh
npm run dev
```
Open your web browser and navigate to the local URL provided in the terminal (usually http://localhost:5173).

The PERT estimation tool should now be running in your browser!

**Important Note:** The PDF export feature relies on two external libraries (`jspdf` and `html2canvas`) that are loaded from a CDN. This means you will need an active internet connection for the PDF export button to become active and function correctly.
