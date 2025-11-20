const Product = require("../models/products");
const { validationResult } = require("express-validator");
const User = require("../models/user");
const { v2: cloudinary } = require("cloudinary");

const io = require("../socket");

exports.getProducts = async (req, res, next) => {
  const page = req.query.page || 1;
  const perPage = req.query.perPage;
  const count = await Product.countDocuments(); // 전체 상품 개수
  const maxPage = Math.ceil(count / perPage); // 한 페이지에 2개 아이템 기준 최대 페이지 수 계산
  const products = await Product.find()
    .skip((page - 1) * perPage)
    .limit(perPage); // 페이지네이션 적용, 한 페이지에 2개 아이템

  // 자바스크립트에서 []는 truthy이기 때문에 항상 참으로 평가됩니다. 주의 !
  if (!products || products.length === 0) {
    return res.status(404).json({ message: "등록된 상품이 없습니다." });
  } // 이렇게 오류 처리해도 되고 아니면 중앙 에러 처리 미들웨어로 넘겨도 됨

  res.status(200).json({ products: products, maxPage: maxPage });
};

exports.createProduct = async (req, res, next) => {
  // [프론트 FormData] → [Multer] → req.file / req.body 생성 → [컨트롤러] → Cloudinary 업로드 → DB 저장

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // 유효성 검사 오류가 있는 경우
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.file) {
      return res.status(400).json({ message: "이미지가 첨부되지 않았습니다." });
    }
    // multer의 메모리 스토리지에 저장된 파일을 Cloudinary에 업로드
    const uploadToCloudinary = (fileBuffer) =>{
      return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { resource_type: "image", folder: "products" },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          } 
        ).end(fileBuffer);
      });
    };
    const uploadResult = await uploadToCloudinary(req.file.buffer);

    const product = new Product({
      title: req.body.title,
      price: req.body.price,
      description: req.body.description,
      imageUrl: uploadResult.secure_url,
      userId: req.user.userId, // 인증 미들웨어에서 설정한 userId 사용
    });
    await product.save();
    io.getIO().emit("productsUpdated", { action: "create" });
    res
      .status(201)
      .json({ message: "상품이 성공적으로 추가되었습니다.", product: product });
  } catch (error) {
    console.error("상품 생성 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

exports.getProductById = async (req, res, next) => {
  const productId = req.params._id;
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ message: "해당 ID의 상품을 찾을 수 없습니다." });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

exports.editProduct = async (req, res, next) => {
  const productId = req.params._id;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // 유효성 검사 오류가 있는 경우
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ message: "해당 ID의 상품을 찾을 수 없습니다." });
    }
    if (product.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }
    const { title, price, description } = req.body;
    product.title = title;
    product.price = price;
    product.description = description;
    if (req.file) {
      clearImage(product.imageUrl); // 기존 이미지 Cloudinary에서 삭제
      // multer의 메모리 스토리지에 저장된 파일을 Cloudinary에 업로드
      const uploadToCloudinary = (fileBuffer) =>{
      return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { resource_type: "image", folder: "products" },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          } 
        ).end(fileBuffer);
      });
    };
    const uploadResult = await uploadToCloudinary(req.file.buffer);
    
      product.imageUrl = uploadResult.secure_url;
    }
    await product.save();
    io.getIO().emit("productsUpdated", { action: "update" });
    res
      .status(200)
      .json({ message: "상품이 성공적으로 수정되었습니다.", product: product });
  } catch (error) {
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

const clearImage = (imgUrl) => {
 try{
  const publicId = imgUrl
    .split("/")
    .pop()
    .split(".")[0]; // Cloudinary public_id 추출
  cloudinary.uploader.destroy(publicId, (error, result) => {
    if (error) {
      console.error("Cloudinary 이미지 삭제 오류:", error);
    } else {
      console.log("Cloudinary 이미지 삭제 성공:", result);
    }
  });
 }
  catch(err){
    console.error("이미지 삭제 중 오류 발생:", err);
  } 
}

exports.deleteProduct = async (req, res, next) => {
  const productId = req.params._id;
  try {
    const product = await Product.findById(productId);
    if (product.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }
    const deletedProduct = await Product.findByIdAndDelete(productId);
    if (!deletedProduct) {
      return res
        .status(404)
        .json({ message: "해당 ID의 상품을 찾을 수 없습니다." });
    }
    clearImage(deletedProduct.imageUrl); // 이미지 파일 삭제

    await User.updateMany(
      // 장바구니 에서 해당 상품 제거
      {},
      { $pull: { "cart.items": { productId: productId } } }
    );
    const count = await Product.countDocuments(); // 전체 상품 개수
    const perPage = req.query.perPage;
    const maxPage = Math.ceil(count / perPage); // 한 페이지에 2개 아이템 기준 최대 페이지 수 계산
    io.getIO().emit("productsUpdated", { action: "delete" });
    res
      .status(200)
      .json({ message: "상품이 성공적으로 삭제되었습니다.", maxPage: maxPage });
  } catch (error) {
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

exports.getCart = async (req, res, next) => {
  // console.log("User ID in getCart:", req.user.userId);
  // populate()를 사용하면 자동으로 JOIN처럼 참조된 데이터를 불러와요. productId에 해당하는 실제 상품 데이터를 cart.items 배열에 채워줍니다.
  // console.log("Populated Cart Items:", req.user.cart.items); // 이 안에 productId : {}객체가 실제 상품 데이터로 채워져 있음
  try {
    let user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }
    user = await user.populate("cart.items.productId");
    console.log("Populated Cart Items:", user.cart.items);

    res.status(200).json({ cart: user.cart.items });
  } catch (error) {
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

exports.addToCart = async (req, res, next) => {
  const item = req.body.item;
  const quantity = req.body.quantity || 1;
  const userId = req.user.userId;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    const cartItemIndex = user.cart.items.findIndex(
      (ci) => ci.productId.toString() === item._id
    );
    if (cartItemIndex >= 0) {
      // 이미 장바구니에 존재하는 상품인 경우 수량만 증가
      user.cart.items[cartItemIndex].quantity += quantity;
    } else {
      // 장바구니에 없는 상품인 경우 새로 추가
      user.cart.items.push({
        productId: item._id,
        quantity: quantity,
      });
    }

    await user.save();
    await user.populate("cart.items.productId");

    res.status(200).json({
      message: "장바구니에 상품이 추가되었습니다.",
      cart: user.cart.items,
    });
  } catch (error) {
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

exports.removeFromCart = async (req, res, next) => {
  const itemId = req.body.itemId;
  const userId = req.user.userId;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    user.cart.items = user.cart.items.filter(
      (ci) => ci.productId.toString() !== itemId
    );
    await user.save();
    await user.populate("cart.items.productId");

    res.status(200).json({
      message: "장바구니에서 상품이 제거되었습니다.",
      cart: user.cart.items,
    });
  } catch (error) {
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

exports.updateCart = async (req, res, next) => {
  const itemId = req.body.itemId;
  const method = req.body.method; // 'increment' or 'decrement'
  const userId = req.user.userId;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    const cartItemIndex = user.cart.items.findIndex(
      (ci) => ci.productId.toString() === itemId
    );
    if (cartItemIndex >= 0) {
      if (method === "increment") {
        user.cart.items[cartItemIndex].quantity += 1;
      } else if (method === "decrement") {
        user.cart.items[cartItemIndex].quantity -= 1;
        if (user.cart.items[cartItemIndex].quantity <= 0) {
          // 수량이 0 이하가 되면 해당 아이템을 장바구니에서 제거
          user.cart.items.splice(cartItemIndex, 1);
        }
      }
    } else {
      return res
        .status(404)
        .json({ message: "장바구니에 해당 상품이 없습니다." });
    }

    await user.save();
    await user.populate("cart.items.productId");

    res.status(200).json({
      message: "장바구니가 업데이트되었습니다.",
      cart: user.cart.items,
    });
  } catch (error) {
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};
