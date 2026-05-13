interface NewsCardProps {
  article: {
    title: string;
    link: string;
    pubDate: string;
    description: string;
    category: string;
  };
}

export default function NewsCard({ article }: NewsCardProps) {
  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      world: 'bg-blue-100 text-blue-800',
      business: 'bg-green-100 text-green-800',
      technology: 'bg-purple-100 text-purple-800',
      entertainment: 'bg-pink-100 text-pink-800',
      sports: 'bg-orange-100 text-orange-800',
      science: 'bg-cyan-100 text-cyan-800',
      health: 'bg-red-100 text-red-800',
    };
    return colors[category] || 'bg-slate-100 text-slate-800';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-slate-200">
      <div className="p-6">
        {/* Category Badge */}
        <div className="flex items-center justify-between mb-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(article.category)}`}>
            {article.category.toUpperCase()}
          </span>
          <span className="text-xs text-slate-500">
            {formatDate(article.pubDate)}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-slate-900 mb-3 line-clamp-2 hover:text-blue-600 transition-colors">
          {article.title}
        </h2>

        {/* Description */}
        <p className="text-slate-600 text-sm mb-4 line-clamp-3">
          {article.description}
        </p>

        {/* Read More Button */}
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                   transition-colors duration-200 text-center font-medium text-sm"
        >
          Read More →
        </a>
      </div>
    </div>
  );
}
