// Image approval state is shared by both card views and tested without a browser.
(function (root) {
  const validURL = value => typeof value === 'string' && /^\/generated\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(value);
  function migrate(cards) {
    let changed = false;
    for (const card of cards) {
      if (card.imageUrl && card.imageApproved !== true) {
        if (validURL(card.imageUrl)) {
          card.pendingImageUrl = card.imageUrl;
          card.pendingImageModel = card.imageModel;
        }
        delete card.imageUrl;
        delete card.imageModel;
        delete card.imageApproved;
        changed = true;
      }
    }
    return changed;
  }
  function stage(card, result) {
    if (!validURL(result.imageUrl)) throw Error('An invalid picture was returned.');
    card.pendingImageUrl = result.imageUrl;
    card.pendingImageModel = result.model;
  }
  function approve(card) {
    if (!validURL(card.pendingImageUrl)) throw Error('No picture is ready for review.');
    card.imageUrl = card.pendingImageUrl;
    card.imageModel = card.pendingImageModel;
    card.imageApproved = true;
    discard(card);
  }
  function discard(card) {
    delete card.pendingImageUrl;
    delete card.pendingImageModel;
  }
  function useEmoji(card, value) {
    const emoji=String(value||'').trim();
    const parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(emoji)]:[...emoji];
    if(parts.length!==1||!/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(emoji))throw Error('Choose one emoji for the picture clue.');
    card.emoji=emoji;discard(card);delete card.imageUrl;delete card.imageModel;delete card.imageApproved;
  }
  function approvedURL(card) {
    return card.imageApproved === true && validURL(card.imageUrl) ? card.imageUrl : null;
  }
  const api = { validURL, migrate, stage, approve, discard, useEmoji, approvedURL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WordRingImages = api;
})(typeof window !== 'undefined' ? window : globalThis);
