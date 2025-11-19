const jwt = require("jsonwebtoken");

const isAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "인증 헤더가 없습니다." });
  }

  const token = authHeader.split(" ")[1]; // "Bearer TOKEN" 형식에서 토큰 추출

  try {
    const decoded = jwt.verify(token, "your_jwt_secret"); // 토큰 검증
    req.user = decoded; // 요청 객체에 user 정보 저장 (userId, email 등)
    // console.log("토큰이 유효합니다. 디코딩된 정보:", decoded);
    next();
  } catch (err) {
    return res.status(401).json({ message: "토큰이 유효하지 않습니다." });
  }
};



module.exports = isAuth;