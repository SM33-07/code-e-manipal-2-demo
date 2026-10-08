export const submission = {
  teamName: "Team ByteForge",
  hackathonName: "Code-e-Manipal",
  submittedAt: "2026-03-12T14:30:00Z",
  project: {
    title: "EcoTrack: AI-Powered Campus Sustainability Monitor",
    summary:
      "An intelligent platform that monitors, analyzes, and gamifies campus energy consumption using IoT sensors and machine learning to drive sustainable behavior among students.",
    category: "Smart City and Infrastructure",
    technologies: [
      "React",
      "TypeScript",
      "Python",
      "TensorFlow",
      "FastAPI",
      "PostgreSQL",
      "MQTT",
      "Raspberry Pi",
      "Tailwind CSS",
      "Docker",
    ],
    teamMembers: [
      { name: "Arjun Mehta", role: "Full-Stack Lead" },
      { name: "Priya Sharma", role: "ML Engineer" },
      { name: "Karthik Nair", role: "IoT & Hardware" },
      { name: "Sneha Reddy", role: "UI/UX Designer" },
    ],
    demoVideoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1",
    githubUrl: "https://github.com/byteforge/ecotrack",
    demoUrl: "https://ecotrack-demo.vercel.app",
    docsUrl: "https://docs.ecotrack.dev",
  },
  writeup: {
    problemStatement: `Campus buildings account for nearly 30% of total energy waste in Indian universities. Students and faculty have no visibility into their energy consumption patterns, leading to apathy and inefficiency. Existing building management systems are expensive, opaque, and provide no incentive for behavioral change. We needed a solution that makes energy data accessible, actionable, and engaging.`,
    solutionOverview: `EcoTrack is a full-stack platform that combines low-cost IoT sensors with machine learning models to provide real-time energy monitoring across campus buildings. It gamifies sustainability by assigning "Green Scores" to hostels and departments, creating friendly competition. The AI component predicts consumption spikes and suggests automated optimizations, while a student-facing dashboard makes complex energy data intuitive and actionable.`,
    technicalImplementation: `Our architecture follows a three-tier design:

**Data Collection Layer:** Raspberry Pi units with current sensors deployed across 5 campus buildings, publishing readings via MQTT every 30 seconds to our message broker.

**Processing & ML Layer:** A FastAPI backend ingests sensor data, stores it in PostgreSQL with TimescaleDB extension for time-series optimization. Our TensorFlow model, trained on 6 months of historical data, predicts consumption patterns and detects anomalies in real-time.

**Presentation Layer:** A React + TypeScript frontend with responsive dashboards showing live consumption graphs, leaderboards, and personalized recommendations. We used Recharts for data visualization and Framer Motion for smooth transitions.`,
    architecture: `The system uses an event-driven microservices architecture:
- IoT Gateway (Raspberry Pi + MQTT)
- Message Broker (Mosquitto)  
- Data Pipeline (FastAPI + Celery)
- ML Service (TensorFlow Serving)
- Database (PostgreSQL + TimescaleDB)
- Frontend (React + Vite)
- Deployment (Docker Compose + Nginx)

All services communicate via REST APIs and MQTT pub/sub. We used Docker Compose for local development and deployed on a DigitalOcean droplet for the demo.`,
    challenges: `**Hardware Calibration:** Current sensors gave inconsistent readings initially. We solved this by implementing a calibration routine and moving average filter.

**Real-time at Scale:** Handling 30-second updates from 50+ sensors required careful database indexing and query optimization with TimescaleDB.

**ML Model Accuracy:** Our initial LSTM model overfit on seasonal patterns. We switched to a Prophet-based ensemble that better handles the irregular academic calendar.

**Time Constraints:** Integrating hardware, ML, and full-stack in 36 hours required extreme prioritization. We scoped the MVP to 5 buildings and pre-trained the model.`,
    futureImprovements: `- Expand to water and waste monitoring
- Integrate with official university BMS systems
- Mobile app with push notifications for consumption alerts
- Carbon credit marketplace for top-performing departments
- Federated learning across multiple campuses for better predictions
- Solar panel output tracking and optimization`,
    reflection: `This hackathon taught us the power of cross-functional teamwork. Having hardware, ML, and frontend expertise on one team let us build something truly end-to-end. The biggest lesson was scoping—we initially planned to cover the entire campus but realized that 5 well-instrumented buildings tell a more compelling story than 20 poorly covered ones. We also learned that gamification drives engagement far more than data alone.`,
  },
  judgeReview: {
    scores: null as { innovation: number; technical: number; impact: number; presentation: number } | null,
    feedback: null as string | null,
  },
};
