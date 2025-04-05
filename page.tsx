import { Metadata } from 'next';
import { CsvUploader } from '@/components/upload/CsvUploader';

export const metadata: Metadata = {
  title: 'Upload ASINs - Amazon Arbitrage',
  description: 'Upload a CSV file containing ASINs from Keepa\'s Product Finder',
};

export default function UploadPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Upload ASINs</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Upload CSV File</h2>
        <p className="text-gray-600 mb-6">
          Upload a CSV file containing ASINs from Keepa&apos;s Product Finder. 
          The system will process each ASIN to find matching products on other websites,
          calculate profitability, and alert you when profitable opportunities are found.
        </p>
        
        <CsvUploader />
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">CSV Format Requirements</h2>
        <p className="text-gray-600 mb-4">
          Your CSV file should contain the following columns:
        </p>
        
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-50 border border-gray-200">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Column Name
                </th>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Description
                </th>
                <th className="py-2 px-4 border-b border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Required
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 px-4 border-b border-gray-200">ASIN</td>
                <td className="py-2 px-4 border-b border-gray-200">Amazon Standard Identification Number</td>
                <td className="py-2 px-4 border-b border-gray-200">Yes</td>
              </tr>
              <tr>
                <td className="py-2 px-4 border-b border-gray-200">UPC</td>
                <td className="py-2 px-4 border-b border-gray-200">Universal Product Code</td>
                <td className="py-2 px-4 border-b border-gray-200">No</td>
              </tr>
              <tr>
                <td className="py-2 px-4 border-b border-gray-200">Title</td>
                <td className="py-2 px-4 border-b border-gray-200">Product Title</td>
                <td className="py-2 px-4 border-b border-gray-200">No</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Example CSV Format:</h3>
          <pre className="bg-gray-100 p-4 rounded text-sm">
            ASIN,UPC,Title
            B01EXAMPLE1,123456789012,Example Product 1
            B01EXAMPLE2,123456789013,Example Product 2
          </pre>
        </div>
      </div>
    </div>
  );
}
