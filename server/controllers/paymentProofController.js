const mongoose=require("mongoose");
const Payment=require("../models/Payment");
const {uploadBuffer,deleteFile,streamFile}=require("../services/fileStorageService");
const MAX_PROOF_BYTES=5*1024*1024;
const ALLOWED_TYPES=new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
const dataUrlPattern=/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/;
const canAccess=(payment,user)=>payment.user.equals(user._id)||user.role==="ADMIN";

const validateProofPayload = (req, res) => {
  const { proofUrl, fileType } = req.body;
  const type = String(fileType || "").toLowerCase();
  if (!ALLOWED_TYPES.has(type)) {
    res.status(400).json({ success: false, message: "Payment proof must be a JPG, PNG, WEBP image or PDF receipt." });
    return null;
  }
  const value = String(proofUrl || "");
  const match = value.match(dataUrlPattern);
  if (!match || match[1].toLowerCase() !== type) {
    res.status(400).json({ success: false, message: "Invalid payment proof payload." });
    return null;
  }
  const base64 = match[2];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const byteLength = Math.floor(base64.length * 3 / 4) - padding;
  if (byteLength <= 0 || byteLength > MAX_PROOF_BYTES) {
    res.status(413).json({ success: false, message: "Payment proof is too large. Maximum size is 5 MB." });
    return null;
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length !== byteLength || buffer.length > MAX_PROOF_BYTES) {
    res.status(413).json({ success: false, message: "Payment proof is too large. Maximum size is 5 MB." });
    return null;
  }
  return { type, buffer };
};

const buildProofFile = (req, payment, { type, buffer }) => {
  const safeName = String(req.body.originalName || "payment-proof").replace(/[\r\n\\/]/g, "_").slice(0, 180) || "payment-proof";
  return {
    buffer,
    filename: `${payment.paymentToken}-${Date.now()}-${safeName}`,
    contentType: type,
    metadata: {
      paymentId: payment._id.toString(),
      userId: req.user._id.toString(),
      paymentToken: payment.paymentToken,
    },
    originalName: safeName,
  };
};

const uploadProof = async (req, payment, proofFile) => {
  const fileId = await uploadBuffer({
    buffer: proofFile.buffer,
    filename: proofFile.filename,
    contentType: proofFile.contentType,
    metadata: proofFile.metadata,
  });
  return {
    fileId,
    fileUrl: `${req.protocol}://${req.get("host")}/api/payments/proof/${payment._id}`,
    fileType: proofFile.contentType,
    originalName: proofFile.originalName,
    uploadedAt: new Date(),
  };
};

const applyProofToPayment = async (req, payment, proof, wasRejected) => {
  payment.proof = proof;
  payment.status = "PROOF_SUBMITTED";
  payment.adminNote = "";
  payment.verifiedBy = null;
  payment.verifiedAt = null;
  await payment.save();
  if (wasRejected) {
    const { createNotification } = require("../services/notificationService");
    await createNotification({
      userId: req.user._id,
      type: "PAYMENT",
      title: "Payment proof resubmitted",
      message: `Your replacement proof for payment ${payment.paymentToken} has been submitted and is awaiting administrator review.`,
      link: `/payment/pending/${payment.paymentToken}`,
    });
  }
};

const submitProof=async(req,res)=>{try{
  const payment=await Payment.findOne({user:req.user._id,$or:[{paymentToken:req.params.token},{reference:req.params.token}]});
  if(!payment)return res.status(404).json({success:false,message:"Payment request not found."});
  if(!["PENDING_PAYMENT","REJECTED"].includes(payment.status))return res.status(400).json({success:false,message:"This payment is not awaiting payment proof."});
  const validated=validateProofPayload(req,res);
  if(!validated)return;
  const proofFile=buildProofFile(req,payment,validated);
  const proof=await uploadProof(req,payment,proofFile);
  const oldFileId=payment.proof?.fileId;
  const wasRejected=payment.status==="REJECTED";
  await applyProofToPayment(req,payment,proof,wasRejected);
  if(oldFileId)await deleteFile(oldFileId);
  return res.json({success:true,message:wasRejected?"Replacement payment proof submitted for administrator review.":"Payment proof submitted for administrator review.",payment})
}catch(error){console.error("Payment proof upload error:",error);return res.status(400).json({success:false,message:error.message||"Unable to submit payment proof."})}};
const getProof=async(req,res)=>{try{if(!mongoose.isValidObjectId(req.params.id))return res.status(404).json({success:false,message:"Payment proof not found."});const payment=await Payment.findById(req.params.id).select("user proof");if(!payment?.proof?.fileId)return res.status(404).json({success:false,message:"Payment proof not found."});if(!canAccess(payment,req.user))return res.status(403).json({success:false,message:"You are not allowed to access this payment proof."});return streamFile({id:payment.proof.fileId,res,contentType:payment.proof.fileType,downloadName:payment.proof.originalName})}catch(error){return res.status(400).json({success:false,message:"Unable to retrieve payment proof."})}};
module.exports={submitProof,getProof};
