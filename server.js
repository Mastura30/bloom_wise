
const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { User, ClassInfo } = require("./db.js");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();


// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "bloomwise-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Configure nodemailer for emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Remove spaces from app password
  },
});

// Send verification email function
const sendVerificationEmail = async (user, req) => {
  try {
    const token = crypto.randomBytes(32).toString("hex"); // Increased token length for security

    user.verificationToken = token;
    user.verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Use the host from the request, but fall back to environment variable or default
    const host = req.headers.host || process.env.DOMAIN || "localhost:5000";
    const protocol =
      req.secure || process.env.NODE_ENV === "production" ? "https" : "http";

    const verificationLink = `${protocol}://${host}/verify-email?token=${token}&email=${encodeURIComponent(
      user.email
    )}`;

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: "Verify Your BloomWise Account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Welcome to BloomWise!</h2>
          <p>Please click the button below to verify your email address:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #555;">${verificationLink}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create this account, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">This is an automated message from BloomWise. Please do not reply to this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Verification email sent to:", user.email);

    return verificationLink; // Return for development purposes
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
};

// Passport Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://bloom-wise.onrender.com/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({
          $or: [{ email: profile.emails[0].value }, { googleId: profile.id }],
        });

        if (user) {
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
          return done(null, user);
        } else {
          const newUser = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
            isVerified: true, // Google emails are already verified
          });
          user = await newUser.save();
          return done(null, user);
        }
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Static files
app.use(express.static("public"));
app.use("/assests", express.static("assests"));

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
};

// Routes
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login", { error: req.query.error, success: req.query.success });
});

app.get("/signup", (req, res) => {
  res.render("signup", { error: req.query.error, success: req.query.success });
});

// Verify email route - SECURITY FIXED
app.get("/verify-email", async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.render("verify-email", {
        success: false,
        message: "Invalid verification link",
      });
    }

    // Find user by both token AND email to prevent token hijacking
    const user = await User.findOne({
      email: decodeURIComponent(email),
      verificationToken: token,
      verificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.render("verify-email", {
        success: false,
        message: "Verification link is invalid or has expired",
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.render("verify-email", {
      success: true,
      message: "Your email has been successfully verified! You can now log in.",
    });
  } catch (error) {
    console.error(error);
    res.render("verify-email", {
      success: false,
      message: "Error verifying email",
    });
  }
});

// Resend verification email
app.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.isVerified) {
      return res.json({ success: false, message: "Email is already verified" });
    }

    await sendVerificationEmail(user, req);
    res.json({ success: true, message: "Verification email sent" });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error sending verification email" });
  }
});

// Forgot password route - show form
app.get("/forgot-password", (req, res) => {
  res.render("forgetpass", {
    error: req.query.error,
    success: req.query.success,
    email: req.query.email || "",
  });
});

// Forgot password route - process request

app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.redirect(
        "/forgot-password?error=No account with that email address exists&email=" +
          encodeURIComponent(email)
      );
    }

    if (user.googleId) {
      return res.redirect(
        "/forgot-password?error=Google accounts cannot reset password here. Please use Google login.&email=" +
          encodeURIComponent(email)
      );
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");

    // Set token and expiration (1 hour)
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email - Fixed the email content
    const host =
      req.headers.host || process.env.DOMAIN || "bloom-wise.onrender.com";
    const protocol =
      req.headers["x-forwarded-proto"] ||
      (req.secure ? "https" : "http") ||
      (process.env.NODE_ENV === "production" ? "https" : "http");

    const resetLink = `${protocol}://${host}/reset-password?token=${token}&email=${encodeURIComponent(
      user.email
    )}`;

    // Email content - simplified for better rendering
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: "BloomWise Password Reset",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Password Reset Request</h2>
          <p>You requested a password reset for your BloomWise account.</p>
          <p>Please click the link below to reset your password:</p>
          <p><a href="${resetLink}" style="color: #4CAF50;">Reset Password</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.redirect(
      "/forgot-password?success=Password reset link has been sent to your email&email=" +
        encodeURIComponent(email)
    );
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.redirect(
      "/forgot-password?error=Error processing your request&email=" +
        encodeURIComponent(req.body.email || "")
    );
  }
});

// Reset password route - show form
app.get("/reset-password", async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.render("resetpass", { tokenError: true });
    }

    const user = await User.findOne({
      email: decodeURIComponent(email),
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.render("resetpass", { tokenError: true });
    }

    res.render("resetpass", {
      token,
      email: decodeURIComponent(email),
      error: req.query.error,
    });
  } catch (error) {
    console.error(error);
    res.render("resetpass", { tokenError: true });
  }
});

// Reset password route - process reset
app.post("/reset-password", async (req, res) => {
  try {
    const { token, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.redirect(
        `/reset-password?token=${token}&email=${encodeURIComponent(
          email
        )}&error=Passwords do not match`
      );
    }

    if (password.length < 6) {
      return res.redirect(
        `/reset-password?token=${token}&email=${encodeURIComponent(
          email
        )}&error=Password must be at least 6 characters`
      );
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.render("resetpass", { tokenError: true });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.redirect("/login?success=Password has been reset successfully");
  } catch (error) {
    console.error(error);
    res.redirect(
      `/reset-password?token=${token}&email=${encodeURIComponent(
        email
      )}&error=Error resetting password`
    );
  }
});

// Google OAuth routes
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  })
);

// Dashboard route
app.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("savedClasses");
    res.render("dashboard", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        savedClasses: user.savedClasses || [],
        analysisResults: user.analysisResults || [],
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading dashboard");
  }
});

// API Routes
// Get user's classes
app.get("/api/classes", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("savedClasses");
    res.json(user.savedClasses || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load classes" });
  }
});

// Save class to server
app.post("/api/save-class", requireAuth, async (req, res) => {
  try {
    const { grade, subject, topic } = req.body;

    // Create new class in ClassInfo collection
    const newClass = new ClassInfo({
      userId: req.user._id,
      grade,
      subject,
      topic,
    });

    await newClass.save();

    // Add class reference to user's savedClasses
    await User.findByIdAndUpdate(req.user._id, {
      $push: { savedClasses: newClass._id },
    });

    res.json({ success: true, class: newClass });
  } catch (error) {
    console.error(error);
    res.json({ success: false, error: "Failed to save class" });
  }
});

// Delete a class
app.delete("/api/class/:id", requireAuth, async (req, res) => {
  try {
    const classId = req.params.id;

    // Verify the class belongs to the user
    const classInfo = await ClassInfo.findOne({
      _id: classId,
      userId: req.user._id,
    });

    if (!classInfo) {
      return res.status(404).json({ error: "Class not found" });
    }

    // Remove from ClassInfo collection
    await ClassInfo.deleteOne({ _id: classId });

    // Remove reference from user's savedClasses
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { savedClasses: classId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete class" });
  }
});

app.post("/api/save-result", requireAuth, async (req, res) => {
  try {
    const { text, level, suggestion } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      $push: { analysisResults: { text, level, suggestion } },
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({ success: false, error: "Failed to save result" });
  }
});

// Clear all results
app.post("/api/clear-results", requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $set: { analysisResults: [] },
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({ success: false, error: "Failed to clear results" });
  }
});

// Get user data
app.get("/api/user-data", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("savedClasses");
    res.json({
      savedClasses: user.savedClasses || [],
      analysisResults: user.analysisResults || [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load user data" });
  }
});

// Auth routes

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Input validation
    if (!name || !email || !password || !confirmPassword) {
      return res.redirect("/signup?error=All fields are required");
    }

    if (password !== confirmPassword) {
      return res.redirect("/signup?error=Passwords do not match");
    }

    // Check if user already exists (case-insensitive)
    const existingUser = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (existingUser) {
      // Check if it's a Google user trying to sign up with password
      if (existingUser.googleId) {
        return res.redirect(
          "/signup?error=This email is already registered with Google. Please use Google login."
        );
      }

      // Check if user is not verified
      if (!existingUser.isVerified) {
        // Delete the existing unverified user to allow fresh signup
        await User.deleteOne({ _id: existingUser._id });
      } else {
        return res.redirect("/signup?error=User already exists");
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      isVerified: false, // Explicitly set to false
    });

    await newUser.save();

    // Now try to send the email
    try {
      const verificationLink = await sendVerificationEmail(newUser, req);

      // Set a session variable to show the verification sent message
      req.session.verificationEmail = newUser.email;
      req.session.save(() => {
        res.redirect(
          "/signup?success=Verification email sent. Please check your inbox."
        );
      });
    } catch (emailError) {
      // If sending email fails, delete the user and show an error
      await User.deleteOne({ _id: newUser._id });
      console.error(emailError);
      res.redirect(
        "/signup?error=Error sending verification email. Please try again."
      );
    }
  } catch (error) {
    console.error(error);
    // Check if it's a duplicate key error
    if (error.code === 11000) {
      return res.redirect("/signup?error=User already exists");
    }
    res.redirect("/signup?error=Error creating account");
  }
});

// Add this route to check verification status
app.get("/check-verification", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.json({ verified: false });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ verified: false });
    }

    res.json({ verified: user.isVerified });
  } catch (error) {
    console.error(error);
    res.json({ verified: false });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.redirect("/login?error=Email and password are required");
    }

    // Case-insensitive email search
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (!user) {
      return res.redirect("/login?error=Invalid credentials");
    }

    if (user.googleId) {
      return res.redirect("/login?error=Please use Google login");
    }

    // Check if email is verified - CRITICAL FIX
    if (!user.isVerified) {
      // Check if verification token has expired
      if (user.verificationExpires && user.verificationExpires < Date.now()) {
        // Delete the expired unverified user
        await User.deleteOne({ _id: user._id });
        return res.redirect(
          "/login?error=Your verification link has expired. Please sign up again."
        );
      }
      return res.redirect(
        "/login?error=Please verify your email before logging in"
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.redirect("/login?error=Invalid credentials");
    }

    req.login(user, (err) => {
      if (err) {
        console.error(err);
        return res.redirect("/login?error=Login failed");
      }
      res.redirect("/dashboard");
    });
  } catch (error) {
    console.error(error);
    res.redirect("/login?error=Login failed");
  }
});

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

// Verification sent page
app.get("/verification-sent", (req, res) => {
  res.render("verification-sent", {
    email: req.query.email,
    verificationLink: req.query.verificationLink,
  });
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(
    `Google OAuth configured with Client ID: ${process.env.GOOGLE_CLIENT_ID}`
  );
});
