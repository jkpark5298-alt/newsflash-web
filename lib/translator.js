// 무료 번역 API 사용
export async function translateText(text, targetLang = 'ko') {
  try {
    const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: targetLang,
        format: 'text'
      })
    });

    const data = await response.json();
    return data.translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // 번역 실패시 원문 반환
  }
}

// 여러 텍스트 한번에 번역
export async function translateBatch(texts, targetLang = 'ko') {
  const promises = texts.map(text => translateText(text, targetLang));
  return await Promise.all(promises);
}
