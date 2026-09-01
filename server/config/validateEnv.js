const required=["MONGODB_URI","JWT_SECRET","CLIENT_URL"];
const validateEnv=()=>{const missing=required.filter(key=>!process.env[key]);if(missing.length){console.error(`Missing required environment variables: ${missing.join(", ")}`);process.exit(1)}if(String(process.env.JWT_SECRET).length<32){console.error("JWT_SECRET must be at least 32 characters long.");process.exit(1)}};
module.exports=validateEnv;
