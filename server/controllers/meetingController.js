const MeetingType = require("../models/MeetingType");
const Booking = require("../models/Booking");
const Membership = require("../models/Membership");
const TIER_ORDER=["FAN","SUPPORTER","INSIDER","VIP"];
const getMeetingTypes=async(req,res)=>{try{return res.json({success:true,data:{meetingTypes:await MeetingType.find({isActive:true}).sort({sortOrder:1,price:1})}})}catch(error){return res.status(500).json({success:false,message:"Unable to retrieve meeting types."})}};
const getMyBookings=async(req,res)=>{try{return res.json({success:true,data:{bookings:await Booking.find({user:req.user._id}).populate("meetingType","name slug duration price currency minimumMembershipTier").sort({scheduledFor:-1})}})}catch(error){return res.status(500).json({success:false,message:"Unable to retrieve bookings."})}};
module.exports={getMeetingTypes,getMyBookings,TIER_ORDER};
