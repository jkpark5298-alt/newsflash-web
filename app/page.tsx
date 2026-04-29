import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <h1 className="text-5xl font-bold text-center mb-4 text-gray-800">
          📰 NewsFlash
        </h1>
        <p className="text-center text-gray-600 mb-12">
          국내외 속보와 만평을 한눈에
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/breaking"
            className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
          >
            <div className="text-6xl mb-4">🔴</div>
            <h2 className="text-2xl font-bold mb-2">속보</h2>
            <p className="text-gray-600">실시간 뉴스 속보</p>
          </Link>
          
          <Link
            href="/cartoons"
            className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
          >
            <div className="text-6xl mb-4">🎭</div>
            <h2 className="text-2xl font-bold mb-2">만평</h2>
            <p className="text-gray-600">오늘의 시사만평</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
