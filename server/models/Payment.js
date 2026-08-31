const mongoose=require("mongoose");
const PaymentConfig=require("./PaymentConfig");
const paymentSchema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},type:{type:String,enum:["MEMBERSHIP","MEETING","GIFT"],required:true,index:true},membership:{type:mongoose.Schema.Types.ObjectId,ref:"Membership",default:null},booking:{type:mongoose.Schema.Types.ObjectId,ref:"Booking",default:null},giftTransaction:{type:mongoose.Schema.Types.ObjectId,ref:"GiftTransaction",default:null},reference:{type:String,required:true,unique:true,index:true},paymentToken:{type:String,required:true,unique:true,index:true},supportAdmin:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},originalAmount:{type:Number,required:true,min:0,validate:{validator:Number.isInteger,message:"Amount must be an integer minor-unit amount."}},originalCurrency:{type:String,default:"USD",uppercase:true,trim:true},amount:{type:Number,required:true,min:0,validate:{validator:Number.isInteger,message:"Amount must be an integer minor-unit amount."}},currency:{type:String,default:"USD",uppercase:true,trim:true},exchangeRate:{type:Number,default:1,min:0},provider:{type:String,enum:["INTERNAL"],default:"INTERNAL"},paymentMethod:{type:String,enum:["CRYPTO","GIFTCARD"],default:null,index:true},crypto:{currency:{type:String,default:null,uppercase:true,trim:true},network:{type:String,default:null,trim:true},walletAddress:{type:String,default:null,trim:true},qrCode:{type:String,default:"",trim:true}},giftCard:{brand:{type:String,default:null,trim:true},instructions:{type:String,default:"",trim:true}},proof:{fileId:{type:mongoose.Schema.Types.ObjectId,default:null},fileUrl:{type:String,default:null},fileType:{type:String,default:null},originalName:{type:String,default:null},uploadedAt:{type:Date,default:null}},status:{type:String,enum:["PENDING_PAYMENT","PROOF_SUBMITTED","SUCCESS","FAILED","REJECTED","CANCELLED","EXPIRED"],default:"PENDING_PAYMENT",index:true},paidAt:{type:Date,default:null},verifiedBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null},verifiedAt:{type:Date,default:null},adminNote:{type:String,default:"",trim:true,maxlength:1000},metadata:{type:mongoose.Schema.Types.Mixed,default:{}}},{timestamps:true});

paymentSchema.pre("validate",async function(){
  if(!this.isNew)return;
  if(this.paymentMethod==="CRYPTO"&&this.crypto?.currency&&this.crypto?.network){
    const config=await PaymentConfig.findOne({key:"default"}).lean();
    const option=(config?.cryptoOptions||[]).find(x=>x.currency===this.crypto.currency&&x.network===this.crypto.network);
    if(option){this.crypto={...this.crypto,walletAddress:option.walletAddress,qrCode:option.qrCode||""};}
  }
  if(this.paymentMethod==="GIFTCARD"&&this.giftCard?.brand){
    const config=await PaymentConfig.findOne({key:"default"}).lean();
    const option=(config?.giftCardOptions||[]).find(x=>x.brand===this.giftCard.brand);
    if(option)this.giftCard={...this.giftCard,brand:option.brand,instructions:option.instructions||""};
  }
});

paymentSchema.index({user:1,createdAt:-1});paymentSchema.index({supportAdmin:1,status:1,createdAt:-1});module.exports=mongoose.model("Payment",paymentSchema);
