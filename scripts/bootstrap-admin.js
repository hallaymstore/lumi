require('dotenv').config();
const mongoose=require('mongoose');
const connectDB=require('../config/db');
const {ensureAdmin}=require('../services/adminBootstrap');
(async()=>{try{await connectDB();await ensureAdmin();console.log('Admin bootstrap yakunlandi.');}catch(e){console.error(e);process.exitCode=1}finally{await mongoose.disconnect().catch(()=>{})}})();
