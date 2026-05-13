'use client';

import { useState } from 'react';

export default function TestInternational() {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTranslate = async () => {
    if (!text.trim()) {
      alert('번역할 텍스트를 입력하세요');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/international', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          targetLang: 'ko'
        }),
      });

      const data = await response.json();
      
      if (data.translatedText) {
        setResult(data.translatedText);
      } else {
        setResult('번역 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (error) {
      setResult('오류 발생: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🌍 번역 API 테스트</h1>
      
      <div style={{ marginTop: '20px' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="영어 텍스트를 입력하세요..."
          style={{
            width: '100%',
            height: '150px',
            padding: '10px',
            fontSize: '16px',
            border: '2px solid #ddd',
            borderRadius: '8px'
          }}
        />
      </div>

      <button
        onClick={handleTranslate}
        disabled={loading}
        style={{
          marginTop: '20px',
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: loading ? '#ccc' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? '번역 중...' : '한국어로 번역'}
      </button>

      {result && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          border: '2px solid #0070f3'
        }}>
          <h3>번역 결과:</h3>
          <p style={{ fontSize: '18px', lineHeight: '1.6' }}>{result}</p>
        </div>
      )}
    </div>
  );
}
