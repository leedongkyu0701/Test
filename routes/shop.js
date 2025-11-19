const express = require('express');
const {body} = require('express-validator');
const router = express.Router();

const shopController = require('../controllers/shop');
const isAuth = require('../util/isAuth');

router.get('/products',isAuth, shopController.getProducts);

router.post('/products',isAuth, [
    body('title').notEmpty().withMessage('상품명은 필수 항목입니다.'),
    body('price').isFloat({ gt: 0 }).withMessage('가격은 0보다 큰 숫자여야 합니다.'),
    body('description').notEmpty().withMessage('설명은 필수 항목입니다.'),
], shopController.createProduct);

router.get('/products/:_id', isAuth, shopController.getProductById);

router.put('/products/:_id/edit', isAuth, [
    body('title').notEmpty().withMessage('상품명은 필수 항목입니다.'),
    body('price').isFloat({ gt: 0 }).withMessage('가격은 0보다 큰 숫자여야 합니다.'),
    body('description').notEmpty().withMessage('설명은 필수 항목입니다.'),
], shopController.editProduct);

router.delete('/products/:_id', isAuth, shopController.deleteProduct);

router.post('/cart', isAuth, shopController.addToCart);

router.get('/cart', isAuth, shopController.getCart);

router.delete('/cart', isAuth, shopController.removeFromCart);

router.put('/cart', isAuth, shopController.updateCart);

module.exports = router;