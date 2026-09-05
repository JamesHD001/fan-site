require("dotenv").config();
const validateEnv=require("./config/validateEnv");
validateEnv();
const app=require("./app");
const connectDatabase=require("./config/database");
const {startMembershipMaintenance}=require("./jobs/membershipMaintenance");
const PORT=process.env.PORT||5000;
const startServer=async()=>{try{await connectDatabase();startMembershipMaintenance();app.listen(PORT,()=>console.log(`Server listening on port ${PORT}`))}catch(error){console.error("Unable to start server.");process.exit(1)}};
startServer();
