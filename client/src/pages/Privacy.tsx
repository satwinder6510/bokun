import { useEffect } from "react";
import { setMetaTags } from "@/lib/meta-tags";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";

export default function Privacy() {
  useEffect(() => {
    setMetaTags(
      "Privacy Policy | Flights and Packages",
      "Read our privacy policy to understand how Flights and Packages collects, uses, and protects your personal information.",
      logoImage
    );
  }, []);

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <div className="h-20" />

      <section className="py-12 md:py-16">
        <div className="container mx-auto px-6 md:px-8 max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="prose prose-sm md:prose-base max-w-none space-y-6 text-muted-foreground">
            <p>
              This privacy policy explains how <strong>Flights and Packages Ltd</strong> ("we", "us", "our") collects, uses, and protects your personal information when you use our website and services.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Name, email address, phone number, and postal address</li>
              <li>Passport details and travel preferences when making bookings</li>
              <li>Payment information (processed securely through our payment providers)</li>
              <li>Communications you send to us</li>
            </ul>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">2. How We Use Your Information</h2>
            <p>
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Process and manage your travel bookings</li>
              <li>Communicate with you about your bookings and enquiries</li>
              <li>Send you marketing communications (with your consent)</li>
              <li>Improve our website and services</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">3. Information Sharing</h2>
            <p>
              We share your personal information with:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Travel suppliers and partners necessary to fulfil your booking (airlines, hotels, tour operators)</li>
              <li>Payment processors for secure transaction handling</li>
              <li>Service providers who assist in operating our website</li>
              <li>Government authorities when required by law</li>
            </ul>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">4. Data Security</h2>
            <p>
              We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">5. Cookies</h2>
            <p>
              Our website uses cookies to enhance your browsing experience, analyse website traffic, and personalise content. You can control cookie preferences through your browser settings.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">6. Your Rights</h2>
            <p>
              Under data protection law, you have rights including:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>The right to access your personal information</li>
              <li>The right to rectification of inaccurate data</li>
              <li>The right to erasure in certain circumstances</li>
              <li>The right to restrict processing</li>
              <li>The right to data portability</li>
              <li>The right to object to processing</li>
            </ul>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">7. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to fulfil the purposes for which it was collected, including to satisfy legal, accounting, or reporting requirements.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">8. Third-Party Links</h2>
            <p>
              Our website may contain links to third-party websites. We are not responsible for the privacy practices or content of these external sites.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">9. Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. Any changes will be posted on this page with an updated revision date.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">10. Contact Us</h2>
            <p>
              If you have any questions about this privacy policy or our data practices, please contact us:
            </p>
            <div className="bg-muted/50 p-6 rounded-md border">
              <p><strong>Flights and Packages Ltd</strong></p>
              <p>Airport House, Purley Way</p>
              <p>Croydon, Surrey CR0 0XZ</p>
              <p>United Kingdom</p>
              <p className="mt-3">
                Email: <a href="mailto:holidayenq@flightsandpackages.com" className="text-primary hover:underline">holidayenq@flightsandpackages.com</a>
              </p>
              <p>
                Phone: <a href="tel:02034325772" className="text-primary hover:underline">020 3432 5772</a>
              </p>
            </div>

            <p className="text-sm text-muted-foreground mt-8">
              Last updated: January 2026
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
