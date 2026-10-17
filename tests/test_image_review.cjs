const test = require('node:test');
const assert = require('node:assert/strict');
const review = require('../public/image-review.js');
const url = '/generated/' + 'a'.repeat(64) + '.jpg';

test('generated pictures remain hidden until explicitly approved', () => {
  const card = {word:'cat'};
  review.stage(card, {imageUrl:url, model:'flux-1-schnell'});
  assert.equal(review.approvedURL(card), null);
  const restored = JSON.parse(JSON.stringify(card));
  assert.equal(restored.pendingImageUrl, url);
  review.approve(restored);
  assert.equal(review.approvedURL(restored), url);
  assert.equal(restored.pendingImageUrl, undefined);
  assert.equal(restored.imageApproved, true);
});

test('previous generated images migrate into the review queue once', () => {
  const card = {word:'cat',imageUrl:url,imageModel:'flux'};
  assert.equal(review.migrate([card]), true);
  assert.equal(review.approvedURL(card), null);
  assert.equal(card.pendingImageUrl, url);
  assert.equal(review.migrate([card]), false);
  review.approve(card);
  assert.equal(review.migrate([card]), false);
  assert.equal(review.approvedURL(card), url);
});

test('keeping word only discards a pending picture', () => {
  const card = {};
  review.stage(card, {imageUrl:url,model:'flux'});
  review.discard(card);
  assert.equal(review.approvedURL(card),null);
  assert.equal(card.pendingImageUrl,undefined);
  assert.throws(()=>review.approve(card));
});

test('approval never accepts arbitrary URLs', () => {
  for(const value of ['https://example.com/picture.jpg','/generated/../../.env','javascript:alert(1)']){
    assert.throws(()=>review.stage({}, {imageUrl:value}));
    assert.equal(review.approvedURL({imageUrl:value,imageApproved:true}),null);
  }
});
