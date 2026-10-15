# 🏆 Code-E-Manipal 2.0 Portal

A high-performance, features-rich web portal designed to coordinate, submit, showcase, and judge hackathon projects for **Code-E-Manipal 2.0** at **Manipal University Jaipur (MUJ)**. Built using a modern Next.js framework, Supabase Auth, and Azure Hosted PostgreSQL, it provides a seamless, roles-based workflow for participants, judges, and administrators.

---

## 🚀 Key Features

### 👤 For Participants (Teams)
* **Team Dashboard**: Manage teammate details, profile information, and submission eligibility.
* **Multi-Section Submission Form**: Input code repository URL, demo video links, screenshots, project descriptions, and technology tags.
* **Submission Status Tracking**: Immediate feedback on validation issues, public repository checks, and round progressions.

### ⚖️ For Judges
* **Interactive Scorecard**: Rate submissions across customized criteria (Innovation, Execution, UI/UX, Presentation, etc.).
* **Real-time Live Standings**: Filter submissions by category, tracks, and average scores.
* **Detailed Submission Views**: Inspect team details, source code repositories, and demo files directly inside the app.

### 🛠️ For Administrators
* **Event Control Center**: Lock/unlock rounds, edit hackathon timelines, and broadcast live global announcement banners.
* **Registration Directory**: Search, filter, and bulk-export participant registrations to Excel/CSV.
* **Analytical Insights**: Monitor submission rates, average scores, and team signups with interactive charts.

### 🎨 General Features
* **Premium Cinematic UI/UX**: Aesthetic design language with dark-mode optimizations, gold/amber hues, and glassmorphic overlays.
* **Dynamic Route Transitions**: Fast-forward animations using framer-motion that trigger selectively on key hub routes.
* **Announcement Banner System**: Authenticated users receive live push banners from administrators.

---

## 🛠️ Technology Stack

* **Core Framework**: [Next.js (App Router)](https://nextjs.org/) (React 18)
* **Styling & Theme**: CSS Variables & Custom Theme styling, dark/light mode with `@tailwindcss/postcss` (TailwindCSS v4 compatibility)
* **Authentication**: [Supabase Auth](https://supabase.com/) with Server-Side Rendering (`@supabase/ssr`)
* **Relational Database**: PostgreSQL hosted on **Azure Database for PostgreSQL Flexible Server** via `pg` pool
* **Visuals & Motion**: [Framer Motion](https://www.framer.com/motion/) for premium animations & transitions
* **Icons**: [Lucide React](https://lucide.dev/)

---

## 📦 Project Structure

```text
├── app/                  # Next.js App Router (pages & API routes)
│   ├── admin/            # Admin dashboard, event control, reports, registrations
│   ├── api/              # Backend endpoints (announcements, teams, users, submissions)
│   ├── gallery/          # Beautiful project showcase gallery
│   ├── judging/          # Judge dashboard & scorecard scoring flow
│   ├── team/             # Team registration & status page
│   ├── SubmissionForm/   # Sectioned project submission system
│   ├── RootClient.tsx    # Global context provider & hub route loader configuration
│   └── layout.tsx        # Global HTML wrapping & metadata
├── components/           # Reusable React components (Navbar, AuthProvider, Sidebar)
├── lib/                  # Library configurations (Supabase client, Azure PG client, helpers)
├── public/               # Public assets (logos, images, backgrounds)
├── styles/               # Styling sheets & tailwind integrations
├── supabase/             # Supabase schema definitions & migration logs
└── utils/                # Utility helper functions
```

---

## ⚙️ Getting Started

### 📋 Prerequisites
* [Node.js](https://nodejs.org/) (v18.x or later recommended)
* A PostgreSQL Database (Azure or local instance)
* A Supabase project (for Authentication)

### 💻 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/LearnIT-MUJ/Code-E-Manipal_Portal.git
   cd Code-E-Manipal_Portal
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory and configure the following variables:
   ```env
   # Supabase Credentials
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Azure PostgreSQL Connection
   DATABASE_URL=postgres://user:password@host:port/database_name?sslmode=verify-full

   # Hackathon Config
   REGISTRATION_ROUND=1
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

5. **Build for Production**:
   ```bash
   npm run build
   npm run start
   ```

---

## 📝 License

Distributed under the MIT License. See [LICENSE](file:///c:/Soham/Coding/GitHub/Code-E-Manipal_Portal/LICENSE) for more details
