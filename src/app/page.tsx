export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Amazon Arbitrage Finder
            </h1>
            <p className="text-xl text-gray-600">
              Find profitable online arbitrage opportunities for Amazon reselling
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-xl overflow-hidden mb-12">
            <div className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between mb-8">
                <div className="mb-6 md:mb-0 md:mr-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Automate Your Amazon Arbitrage Business
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Upload ASINs from Keepa, and our system will automatically:
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <span>Find websites selling the same products</span>
                    </li>
                    <li className="flex items-start">
                      <span>Extract pricing, stock, and product details</span>
                    </li>
                    <li className="flex items-start">
                      <span>Calculate profit margins and ROI</span>
                    </li>
                    <li className="flex items-start">
                      <span>Monitor price changes daily</span>
                    </li>
                    <li className="flex items-start">
                      <span>Send email alerts for profitable opportunities</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <a href="/dashboard" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg text-lg">
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
