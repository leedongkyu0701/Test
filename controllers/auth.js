const User = require("../models/user");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs"); // 비밀번호 해싱 라이브러리
const jwt = require("jsonwebtoken");
const e = require("express");

exports.signUp = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 12); // 비밀번호 해싱
    const user = new User({
      email: email,
      password: hashedPassword,
      passwordConfirm: hashedPassword,
      cart: { items: [] },
    });
    await user.save();
    res.status(201).json({ message: "회원가입이 성공적으로 완료되었습니다." });
  } catch (error) {
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(401)
        .json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    }
    await user.save();
    const accessToken = jwt.sign(
      // 액세스 토큰 생성
      { userId: user._id.toString(), email: user.email },
      "your_jwt_secret",
      { expiresIn: "1h" }
    );
    const refreshToken = jwt.sign(
      // 리프레시 토큰 생성
      { userId: user._id.toString(), email: user.email },
      "refresh_jwt_secret",
      { expiresIn: "7d" }
    );
    // console.log(refreshToken + "리프레시 토큰 생성됨");
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
      // www.example.com, api.example.com, shop.example.com)에서 쿠키를 접근할 수 있게 됨
    });
    // 배포때는 secure: true 로 변경

    // console.log("리프레시 토큰 쿠키 설정됨: " + refreshToken);
    user.refreshToken = refreshToken;
    await user.save();
    // HTTP-only 쿠키에 토큰 저장 예전에는 로컬스토리지에 저장했지만 지금은 보안때문에 쿠키에 저장
    return res
      .status(200)
      .json({ message: "logged in", accessToken: accessToken });
  } catch (error) {
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

exports.logout = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  console.log("로그아웃 요청 받음, 리프레시 토큰:", refreshToken);
  if (refreshToken) {
    await User.updateOne(
      { refreshToken: refreshToken },
      { $set: { refreshToken: null } }
    );
  }
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
  res.status(200).json({ message: "로그아웃 되었습니다." });
};

exports.refreshToken = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  console.log("리프레시 토큰 요청 받음:", refreshToken);
  if (!refreshToken) {
    return res.status(401).json({ message: "리프레시 토큰이 없습니다." });
  }
  try {
    const decoded = jwt.verify(refreshToken, "refresh_jwt_secret");

    // 👉 DB에서 refreshToken 일치하는 유저 찾기
    const user = await User.findOne({
      _id: decoded.userId,
      refreshToken: refreshToken,
    });

    if (!user) {
      // 탈취되었거나, 조작된 토큰일 가능성 있음
      return res.status(401).json({ message: "유효하지 않은 리프레시 토큰" });
    }

    const newAccessToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      "your_jwt_secret",
      { expiresIn: "1h" }
    );
    return res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    return res
      .status(401)
      .json({ message: "리프레시 토큰이 유효하지 않습니다." });
  }
};
