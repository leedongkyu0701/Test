const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const multer = require('multer')
// const helmet = require('helmet');
const compress = require('compression');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config(); // .env 파일의 환경 변수 로드

const {v2: cloudinary} = require('cloudinary');
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
}); 

const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');
   

const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg'
    ) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

const upload = multer({ // 메모리 스토리지에 파일 저장 => Cloudinary로 바로 업로드 가능
    storage: multer.memoryStorage(),
    fileFilter: fileFilter
})

// app.use(helmet());
if (process.env.NODE_ENV === "development") {
//   app.use(morgan("dev")); // 개발용
} // 배포용은 pino 같은 더 고성능 로깅 라이브러리 사용 권장 근데 보통 호스트가 제공하는 로깅 솔루션을 사용해서 따로 설정 필요 없을듯 ?
app.use(compress());

app.use(express.json());
app.use(cors({
  origin: "https://test-frontend-five-pearl.vercel.app"
}));
app.use(cookieParser());
app.set("trust proxy", 1); // Render 등 프록시 환경에서는 필수
app.use(upload.single('image')); 
// app.use('/images', express.static('images')); // 이제 로컬에 이미지 저장하지 않음

app.use('/shop', shopRoutes);
app.use('/auth', authRoutes);

async function startServer() {
    await mongoose.connect(
        `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.vavv2se.mongodb.net/shoppingmall?appName=Cluster0`
      );
    console.log("Connected to MongoDB");

    const server = app.listen(process.env.PORT || 8080);
    const io = require("./socket").init(server); // socket.js의 init 함수 호출하여 Socket.io 서버 초기화
    
    io.on('connection', (socket) => {
        console.log('New client connected', socket.id);

        socket.on('disconnect', () => {
            console.log('Client disconnected', socket.id);
        });
    }); 
}

startServer();