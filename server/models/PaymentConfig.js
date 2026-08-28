const mongoose=require("mongoose");
const cryptoOptionSchema=new mongoose.Schema({currency:{type:String,required:true,uppercase:true,trim:true},network:{type:String,required:true,trim:true},walletAddress:{type:String,required:true,trim:true},isActive:{type:Boolean,default:true}},{_id:true});
const giftCardOptionSchema=new mongoose.Schema({brand:{type:String,required:true,trim:true},instructions:{type:String,default:"Contact payment support for gift-card delivery instructions.",trim:true},isActive:{type:Boolean,default:true}},{_id:true});
const paymentConfigSchema=new mongoose.Schema({key:{type:String,default:"default",unique:true},cryptoOptions:{type:[cryptoOptionSchema],default:[]},giftCardOptions:{type:[giftCardOptionSchema],default:[]},updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null}},{timestamps:true});
module.exports=mongoose.model("PaymentConfig",paymentConfigSchema);
