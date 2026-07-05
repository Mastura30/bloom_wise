const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB using Atlas URI
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Database connected successfully");
  })
  .catch((error) => {
    console.error("Database connection error:", error);
  });

// User schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: "Please enter a valid email",
    },
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
    minlength: 6,
  },
  googleId: {
    type: String,
    sparse: true,
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  isVerified: {
    type: Boolean,
    default: false,
    required: true,
  },
  verificationToken: String,
  verificationExpires: Date,
  savedClasses: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassInfo",
    },
  ],
  analysisResults: [
    {
      text: String,
      level: String,
      suggestion: String,
      ts: { type: Date, default: Date.now },
    },
  ],
});

// Create case-insensitive index for email
userSchema.index(
  { email: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

// ClassInfo schema
const classInfoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  grade: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  topic: {
    type: String,
    required: true,
  },
  ts: {
    type: Date,
    default: Date.now,
  },
});

// Create models
const User = mongoose.model("User", userSchema);
const ClassInfo = mongoose.model("ClassInfo", classInfoSchema);

module.exports = { User, ClassInfo };
