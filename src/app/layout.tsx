export const metadata = {
  title: 'Amazon Arbitrage Finder',
  description: 'Find profitable online arbitrage opportunities for Amazon reselling',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
