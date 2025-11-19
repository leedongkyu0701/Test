const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const authController = require("../controllers/auth");
const User = require("../models/user");
const isAuth = require("../util/isAuth");

router.post(
  "/signup",
    [
        body("email").isEmail().withMessage("유효한 이메일 주소를 입력해주세요."),
        body("email").custom(async (value) => {
            const existingUser = await User.findOne({ email: value });
            if (existingUser) {
                throw new Error("이미 사용 중인 이메일 주소입니다.");
            }
            return true;
        }),
        body("password").isLength({ min: 6 }).withMessage("비밀번호는 최소 6자 이상이어야 합니다."),
        body("passwordConfirm").custom((value,{req}) =>{
            if(value !== req.body.password){
                throw new Error("비밀번호 확인이 일치하지 않습니다.");
            }
            return true;
        } )
    ]
  ,authController.signUp
);

router.post("/login",[
    body("email").isEmail().withMessage("유효한 이메일 주소를 입력해주세요."),
    body("password").notEmpty().withMessage("비밀번호를 입력해주세요."),
],authController.login);

router.post("/logout", authController.logout);

router.post("/refresh-token", authController.refreshToken);


module.exports = router;