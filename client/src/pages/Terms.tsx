import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone } from "lucide-react";
import { useDynamicPhoneNumber } from "@/components/DynamicPhoneNumber";
import logoImage from "@assets/flights-and-packages-logo_1763744942036.png";
import travelTrustLogo from "@assets/TTA_1-1024x552_resized_1763746577857.png";
import { useEffect } from "react";
import { setMetaTags } from "@/lib/meta-tags";

export default function Terms() {
  const phoneNumber = useDynamicPhoneNumber();
  
  useEffect(() => {
    setMetaTags(
      "Terms & Conditions | Flights and Packages",
      "Read our terms and conditions for booking tours and travel arrangements with Flights and Packages.",
      logoImage
    );
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-3 md:gap-6">
            <a 
              href={`tel:${phoneNumber.replace(/\s/g, "")}`}
              className="hidden md:inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover-elevate transition-colors"
              data-testid="link-header-phone"
            >
              <Phone className="w-4 h-4" />
              {phoneNumber}
            </a>
            <Link href="/">
              <img 
                src={logoImage} 
                alt="Flights and Packages" 
                className="h-10 md:h-12 w-auto"
                data-testid="img-logo"
              />
            </Link>
            <img 
              src={travelTrustLogo} 
              alt="Travel Trust Association - Your Holidays 100% Financially Protected" 
              className="hidden md:block h-8 md:h-10 w-auto"
              aria-label="Travel Trust Association member"
            />
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-20" />

      {/* Content */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-6 md:px-8 max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-8">Terms and Conditions</h1>
          
          <div className="prose prose-sm md:prose-base max-w-none space-y-6 text-muted-foreground">
            <p>
              Except where otherwise specified, we, <strong>Flights and Packages Ltd</strong> of Airport House, Purley Way, Croydon, Surrey, CR0 0XZ, United Kingdom act only as an agent in respect of all bookings we take and/or make on your behalf. We accept no liability in relation to any contract you enter into or for any travel arrangements or other services you purchase ("Arrangements") or for the acts or omissions of any supplier or other person(s) or party(ies) connected with any arrangements. For all arrangements, your contract will be with the supplier of the arrangements in question (the 'Supplier/Principal'). When making your booking we will arrange for you to enter into a contract with the applicable Supplier/Principal of the Arrangements. Your booking with us is subject to these Agency Terms and Conditions and the specific booking conditions of the relevant Supplier/Principal(s) you contract with and you are advised to read both carefully prior to booking. The Supplier/Principal's booking conditions may limit and/or exclude the Supplier/Principal's liability to you. Copies of applicable conditions are available on request from us.
            </p>

            <p>
              You may decide to make one or more bookings with us at the same time. The price charged in total for more than one booking will always equal the prices charged separately for each individual booking. All Arrangements are available to be purchased separately at the same price as they are when more than one booking is made. This means that any multiple bookings do not constitute a package as defined in the Package Travel, Package Holidays and Package Tours Regulations 1992 but may constitute a 'Flight-Plus' for the purposes of the Civil Aviation (Air Travel Organisers' Licensing) Regulations 2012. We provide financial security for Flight Plus bookings through our membership with the TTA (membership number: U6837) and under ATOL number T7311. See clause 13 for further information on Flight-Plus bookings.
            </p>

            <div className="bg-muted/50 p-6 rounded-md border">
              <h3 className="text-lg font-semibold mb-3 text-foreground">By making a booking with us, you agree that you:</h3>
              <ul className="space-y-2 list-disc list-inside">
                <li>have read these Agency Terms & Conditions and agree to be bound by them</li>
                <li>consent to our use of your information in accordance with our Privacy Policy; and</li>
                <li>are over 18 years of age and resident in the United Kingdom and where placing an order for services with age restrictions you declare that you and all members of your party are of the appropriate age to purchase those services;</li>
                <li>Accept financial responsibility for payment of the booking on behalf of all persons detailed on the booking.</li>
              </ul>
            </div>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">1. Booking and Payment</h2>
            <p>
              In order to confirm your chosen Arrangements, you must pay a deposit as required by the Supplier Principal of the Arrangements (or full payment if booking within [12 weeks] of departure). You must also pay all applicable insurance premiums and booking fees. Your booking is confirmed and a contract between you and the Supplier Principal will exist when we send you confirmation on their behalf. Please check your confirmation carefully and report any incorrect or incomplete information to us immediately. Please ensure that names are exactly as stated in the relevant passport. As we act only as booking agent, we have no responsibility for any errors in any documentation except where an error is made by us. If you have paid a deposit, you must pay the full balance by the balance due date notified to you. If full payment is not received by the balance due date, we will notify the Supplier Principal who may cancel your booking and charge the cancellation fees set out in their booking conditions. Except where otherwise advised or stated in the booking conditions of the Supplier/Principal concerned, all monies you pay to us for Arrangements will be held on behalf of the Supplier/Principal and forwarded on to the Supplier/Principal in accordance with our agreement with the Supplier/Principal.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">2. Prices</h2>
            <p>
              We reserve the right to amend advertised prices at any time. We also reserve the right to correct errors in both advertised and confirmed prices. Special note: changes and errors sometimes occur. You must check the price of your chosen arrangements at the time of booking.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">3. Insurance</h2>
            <p>
              You are strongly recommended to take out personal travel insurance for all members of your party. Some Supplier/Principals require that you do so. It is your responsibility to ensure that the insurance you purchase is adequate and appropriate for your particular needs. Please read your policy details on receipt and take them with you on holiday.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">4. Special Requests</h2>
            <p>
              If you have any special requests (for example dietary requirements, cots or room location), please let us know at the time of booking. We will pass on all such requests to the Supplier/Principal, but we can't guarantee that they will be met and we will have no liability to you if they are not.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">5. Changes and Cancellations by You</h2>
            <p>
              Any cancellation or amendment request must be sent to us in writing, by email, and will take effect at the time we receive it. Please ensure that you have received written confirmation of any changes to your booking prior to travel. Whilst we will try to assist, we cannot guarantee that such requests will be met. Amendments and cancellations can only be accepted in accordance with the booking conditions of the Supplier/Principal of your Arrangements. The Supplier/Principal may charge the cancellation or amendment charges shown in their booking conditions (which may be as much as 100% of the cost of the Arrangements and will normally increase closer to the date of departure). In addition you must pay us an administration fee of £50 per person per booking.
            </p>
            <p className="font-semibold">
              Please note: some Supplier/Principals do not allow changes and therefore full cancellation charges will apply.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">6. Changes and Cancellations by the Supplier/Principal</h2>
            <p>
              We will inform you as soon as reasonably possible if the Supplier/Principal needs to make a significant change to your confirmed Arrangements or to cancel them. We will also liaise between you and the Supplier/Principal in relation to any alternative arrangements offered by the supplier but we will have no further liability to you.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">7. Our Responsibility for Your Booking</h2>
            <p>
              Your contract is with the Supplier/Principal and its booking conditions apply. As agent, we accept no responsibility for the actual provision of the Arrangements. Our responsibilities are limited to making the booking in accordance with your instructions. We accept no responsibility for any information about the Arrangements that we pass on to you in good faith. However, in the event that we are found liable to you on any basis whatsoever, our maximum liability to you is limited to twice the cost of the commission we earn on your booking (or the appropriate proportion of this if not everyone on the booking is affected). We do not exclude or limit any liability for death or personal injury that arises as a result of our negligence or that of any of our employees whilst acting in the course of their employment.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">8. Visa, Passport and Health Requirements</h2>
            <p>
              Unless you tell us otherwise, we are entitled to assume that all members of your party are British citizens who hold or will hold full British passports valid for the entire duration of the Arrangements you chose to purchase. Information on visa, passport and health requirements, where given and applicable, is so given on this basis. Requirements may change and you are therefore strongly recommended to check the up to date position with the supplier of the arrangements, Passport Office, appropriate embassy or consulate or your doctor as applicable in good time before departure.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">9. Complaints</h2>
            <p>
              Because the contract for your Arrangements is between you and the Supplier/Principal, any queries or concerns about your Arrangements should be addressed to them. If you have a problem with your Arrangements whilst using them, this must be reported to the Supplier/Principal immediately. If you fail to follow this procedure there will be less opportunity for the Supplier/Principal to investigate and rectify your complaint. The amount of compensation you may be entitled to may therefore be reduced or extinguished as a result.
            </p>
            <p>
              If you wish to complain when you return home, write to the Supplier/Principal. You will see their name and contact details in any confirmation documents we send you.
            </p>
            <p>
              If you wish to complain about any service we have provided to you (i.e. our booking service) then please contact us directly.
            </p>
            <p>
              You can access the European Commission Online Dispute (ODR) Resolution platform at <a href="https://ec.europa.eu/consumers/odr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">10. Law and Jurisdiction</h2>
            <p>
              These Agency Terms & Conditions are governed by English law and we both agree that the courts of England and Wales have exclusive jurisdiction (unless you live in Scotland or Northern Ireland, in which case you can bring proceedings in your local court under Scottish or Northern Irish law, as applicable).
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">11. Accommodation Ratings and Standards</h2>
            <p>
              All ratings are as provided by the relevant Supplier/Principal. These are intended to give a guide to the services and facilities you should expect from your accommodation. Standards and ratings may vary between countries, as well as between suppliers. We cannot guarantee the accuracy of any ratings given.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">12. Documentation & Information</h2>
            <p>
              All descriptions and content on our website or otherwise issued by us is done so on behalf of the Supplier/Principal in question are intended to present a general idea of the services provided by the Supplier/Principal. Not all details of the relevant services can be included on our website. All services shown are subject to availability. If you require any further details, in respect of any Arrangements or any other services please contact us.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">13. Flight-Plus Bookings</h2>
            <p>
              Booking a Flight-Plus provides you with protection under our ATOL in the event of supplier insolvency, but we are still acting as agent for the individual suppliers and a Flight-Plus booking does not constitute a package as defined in the Package Travel etc Regulations 1992. We do however accept responsibility as a Flight-Plus arranger as defined in the Civil Aviation (Air Travel Organisers' Licensing) Regulations 2012.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3 text-foreground">What is a Flight-Plus?</h3>
            <p>
              A Flight-Plus exists where you book a flight out of the UK, or a flight into the UK where you departed from the UK by another means and on the same day, the day before or the day after, you also book either living accommodation or self-drive car hire which takes place outside the UK and is supplied under or in connection with your flight. In all cases the services must cover a period of more than twenty four hours or include overnight living accommodation in order to make them a Flight-Plus. If in connection with the flight, on the same day, the day before or the day after you book the flight, you also book any other tourist services which are not ancillary to flight or living accommodation and which account for a significant proportion of the Flight-Plus, they will also form part of the Flight-Plus.
            </p>
            <p>
              A Flight-Plus will also exist where on the same day, the day before or the day after you book: a) a non flight inclusive Package, you book a flight out of the UK, or a flight into the UK where you departed from the UK by another means or b) a flight inclusive Package, where you book accommodation or self-drive car hire outside the UK. Please note that a flight which begins and ends in the United Kingdom will not form part of a Flight-Plus. A Flight-Plus will cease to exist and this clause will not apply if you cancel any component of your Flight-Plus; and as a consequence of that cancellation, the definition of a Flight-Plus is no longer satisfied. Where you book a Flight-Plus, we will be a Flight-Plus Arranger in accordance with the definitions set out in Regulation 25 of The Civil Aviation (Air Travel Organisers' Licensing) Regulations 2012.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3 text-foreground">Our Liability for Flight-Plus</h3>
            <p>
              In these conditions, the failure or insolvency of a provider will have the meaning prescribed in Regulation 23 of the ATOL Regulations 2012. If, before your intended departure on a Flight-Plus we become aware that any part of your Flight-Plus will not be provided a) because of the insolvency of any person concerned with the provision of the arrangements making up a Flight-Plus or b) because the ATOL holder providing your flight accommodation is insolvent, cannot or will not be able to meet, or will fail to meet its obligations to its customers, we will make reasonable endeavours to provide you with suitable alternative arrangements at no extra cost. If it is impossible to make such arrangements, we will give you a full refund of all monies paid to us in respect of your Flight-Plus.
            </p>
            <p>
              If, after your intended departure on a Flight-Plus we become aware your flight arrangements will not be provided a) because of the insolvency of any person concerned with the provision of the flight accommodation making up your Flight-Plus or b) because the ATOL holder providing your flight accommodation is insolvent, cannot or will not be able to meet, or will fail to meet its obligations to its customers, we or the CAA will provide you with suitable alternative transport back to the place of departure or to another return point to which you have agreed.
            </p>
            <p>
              If, after your intended departure on a Flight-Plus we become aware that your living accommodation or self-drive car hire will not be provided because of the insolvency of any person concerned with the provision of the living accommodation or self-drive car hire making up your Flight-Plus, we will provide you with suitable alternative living accommodation or self-drive car hire at no extra cost. If it is impossible to make such arrangements, we will give you a full refund of all monies paid to us in respect of all unused flight accommodation, living accommodation, self-drive car hire and other tourist services forming part of your Flight-Plus.
            </p>
            <p>
              Where suitable alternative arrangements are provided as set out in this section, we will where appropriate, pay you reasonable compensation, to include any incidental expenses reasonably incurred by you and evidenced by receipts. Compensation will not be payable if living accommodation or self drive car hire is offered by us and accepted by you with a higher price than that originally booked and is supplied in the same location as originally booked where no additional payment is made by you.
            </p>
            <p>
              If cancellation occurs for reasons other than relating to insolvency, we will not be liable to pay you compensation and the above options will not be available. As agent, whether or not we have sold you a Flight-Plus, we will not be liable in respect of quality complaints, any general losses, distress or disappointment suffered by you in relation to your booking, and any such claims must be directed to the relevant supplier of the element in question. We will not make suitable alternative arrangements or pay you compensation in respect of any tourist services forming part of your Flight-Plus. A refund will be given in respect of these services in the event of insolvency but we will have no further liability.
            </p>
            <p>
              We, or the suppliers identified on your ATOL Certificate, will provide you with the services listed on the ATOL Certificate (or a suitable alternative). In some cases, where neither we nor the supplier are able to do so for reasons of insolvency, an alternative ATOL holder may provide you with the services you have bought (at no extra cost to you). You agree to accept that in those circumstances the alternative ATOL holder will perform those obligations and you agree to pay any money outstanding to be paid by you under your contract to that alternative ATOL holder. However, you also agree that in some cases it will not be possible to appoint an alternative ATOL holder, in which case you will be entitled to make a claim under the ATOL Scheme (or your credit card issuer where applicable).
            </p>
            <p>
              If we, or the suppliers identified on your ATOL certificate, are unable to provide the services listed (or a suitable alternative, through an alternative ATOL holder or otherwise) for reasons of insolvency, the Trustees of the Air Travel Trust may make a payment to (or confer a benefit on) you under the ATOL scheme. You agree that in return for such a payment or benefit you assign absolutely to those Trustees any claims which you have or may have arising out of or relating to the non-provision of the services, including any claim against us, the travel agent (or your credit card issuer where applicable). You also agree that any such claims may be re-assigned to another body, if that other body has paid sums you have claimed under the ATOL scheme.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3 text-foreground">Financial Protection for Flight-Plus Bookings</h3>
            <p>
              We provide financial security for Flight-Plus arrangements through our membership with the TTA (membership number: U6837) and ATOL number T7311. The TTA provides total financial protection for the customers of TTA Members' in the event of a TTA Member's financial failure. The financial protection involves two aspects. Firstly, every TTA Member operates a Trust Account. Every single penny received from a customer must be deposited into the TTA Member's Trust Account. The Trust Account is supervised by an independent Trustee. Secondly, in addition to the Trust Account, every TTA Member will issue a Stand Alone Safe Seat Plan Guarantee to each passenger. This is a Guarantee from the TTA to the customer of their financial protection. Therefore, the Trust Account and the Guarantee will ensure that all the money which a customer has paid to a TTA Member is safely protected.
            </p>
            <p>
              When you buy a Flight-Plus product from us you will receive an ATOL Certificate. This lists the flight, accommodation, car hire and/or other services that are financially protected, where you can get information on what this means for you and who to contact if things go wrong. For further information, visit the ATOL website at <a href="https://www.atol.org.uk" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.atol.org.uk</a>. The price of our flight inclusive arrangements includes the amount of £2.50 per person as part of the ATOL Protection Contribution (APC) we pay to the CAA. This charge is included in our advertised prices. Not all holiday or travel services offered and sold by us will be protected by the ATOL Scheme. ATOL protection extends primarily to Customers who book and pay in the United Kingdom.
            </p>
            <p>
              We, or the suppliers identified on your ATOL Certificate, will provide you with the services listed on the ATOL Certificate (or a suitable alternative). In some cases, where neither we nor the supplier are able to do so for reasons of insolvency, an alternative ATOL holder may provide you with the services you have bought (at no extra cost to you). You agree to accept that in those circumstances the alternative ATOL holder will perform those obligations and you agree to pay any money outstanding to be paid by you under your contract to that alternative ATOL holder. However, you also agree that in some cases it will not be possible to appoint an alternative ATOL holder, in which case you will be entitled to make a claim under the ATOL Scheme (or your credit card issuer where applicable).
            </p>
            <p>
              If we, or the suppliers identified on your ATOL certificate, are unable to provide the services listed (or a suitable alternative, through an alternative ATOL holder or otherwise) for reasons of insolvency, the Trustees of the Air Travel Trust may make a payment to (or confer a benefit on) you under the ATOL scheme. You agree that in return for such a payment or benefit you assign absolutely to those Trustees any claims which you have or may have arising out of or relating to the non-provision of the services, including any claim against us, the travel agent (or your credit card issuer where applicable). You also agree that any such claims may be re-assigned to another body, if that other body has paid sums you have claimed under the ATOL scheme.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-6 md:px-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2025 Flights and Packages. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
