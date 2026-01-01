const TermsOfService = () => {
  document.title = 'Terms of Service - SyncVibe';
  window.scrollTo(0, 0);

  return (
    <div className='py-10'>
      <div className='max-w-4xl mx-auto px-6 py-14 lg:px-8 shadow-lg rounded-lg'>
        <header className='border-b pb-6 mb-6'>
          <h1 className='text-3xl font-bold '>Terms of Service</h1>
          <p className='mt-2 '>Last Updated: January 10, 2025</p>
        </header>

        <main className='space-y-6  leading-relaxed'>
          <section>
            <h2 className='text-xl font-semibold '>1. Acceptance of Terms</h2>
            <p className='mt-2'>
              By accessing or using the SyncVibe website, you agree to comply with and be bound by
              these Terms of Service. If you do not agree to these terms, please refrain from using
              our services.
            </p>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>2. Eligibility</h2>
            <p className='mt-2'>
              You must be at least 13 years old to use SyncVibe. By using the website, you confirm
              that you meet this age requirement.
            </p>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>3. Account Responsibilities</h2>
            <ul className='list-disc list-inside space-y-2 mt-2'>
              <li>
                You are responsible for maintaining the confidentiality of your account information.
              </li>
              <li>
                You agree to notify us immediately if you suspect unauthorized access to your
                account.
              </li>
              <li>You are responsible for all activities that occur under your account.</li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>4. Prohibited Activities</h2>
            <p className='mt-2'>When using SyncVibe, you agree not to:</p>
            <ul className='list-disc list-inside space-y-2 mt-2'>
              <li>Post or share content that is illegal, harmful, or offensive.</li>
              <li>
                Engage in activities that disrupt or interfere with the website’s functionality.
              </li>
              <li>Use automated tools to access or manipulate the website.</li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>5. Intellectual Property</h2>
            <p className='mt-2'>
              All content, trademarks, and logos on SyncVibe are the property of their respective
              owners. You agree not to use or distribute any content without prior authorization.
            </p>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>6. Termination</h2>
            <p className='mt-2'>
              We reserve the right to suspend or terminate your access to SyncVibe at our sole
              discretion, without prior notice, for violating these terms or engaging in prohibited
              activities.
            </p>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>7. Limitation of Liability</h2>
            <p className='mt-2'>
              SyncVibe is provided "as is" without warranties of any kind. We are not liable for any
              damages or losses resulting from your use of the website.
            </p>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>8. Governing Law</h2>
            <p className='mt-2'>
              These terms are governed by the laws of [Your Jurisdiction]. Any disputes will be
              resolved exclusively in the courts of [Your Location].
            </p>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>9. Changes to Terms</h2>
            <p className='mt-2'>
              We may update these Terms of Service from time to time. Continued use of SyncVibe
              after changes are posted constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>10. Contact Us</h2>
            <p className='mt-2'>
              If you have questions about these Terms of Service, please contact us at{' '}
              <a href='mailto:info@thakur.dev' className='text-blue-600 hover:underline'>
                info@thakur.dev
              </a>
              .
            </p>
          </section>
        </main>
      </div>
    </div>
  );
};

export default TermsOfService;
