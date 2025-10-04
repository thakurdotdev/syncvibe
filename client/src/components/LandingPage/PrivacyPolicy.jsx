const PrivacyPolicy = () => {
  document.title = 'Privacy Policy - SyncVibe';
  window.scrollTo(0, 0);

  return (
    <div className='py-10'>
      <div className='max-w-4xl mx-auto px-6 py-14 lg:px-8 shadow-lg rounded-lg'>
        <header className='border-b pb-6 mb-6'>
          <h1 className='text-3xl font-bold '>Privacy Policy</h1>
          <p className='mt-2 text-gray-600'>Last Updated: January 10, 2025</p>
        </header>

        <main className='space-y-6  leading-relaxed'>
          <section>
            <h2 className='text-xl font-semibold '>1. Introduction</h2>
            <p className='mt-2'>
              Welcome to SyncVibe! Your privacy is critically important to us. This Privacy Policy
              explains how we collect, use, and safeguard your information when you use our website.
              By using SyncVibe, you agree to the terms outlined in this policy.
            </p>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>2. Information We Collect</h2>
            <ul className='list-disc list-inside space-y-2 mt-2'>
              <li>
                <strong>Personal Information:</strong> Your name, email address, and any other
                information you provide during registration.
              </li>
              <li>
                <strong>Usage Data:</strong> Information about how you interact with our website,
                such as pages visited and features used.
              </li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>3. How We Use Your Information</h2>
            <p className='mt-2'>We use the information we collect for the following purposes:</p>
            <ul className='list-disc list-inside space-y-2 mt-2'>
              <li>To provide and maintain the SyncVibe platform.</li>
              <li>To improve user experience and add new features.</li>
              <li>To communicate with you about updates, promotions, and support.</li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>4. Sharing Your Information</h2>
            <p className='mt-2'>
              We do not sell, trade, or rent your personal information to others. We may share your
              data with trusted partners to help us provide and improve our services, subject to
              confidentiality agreements.
            </p>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>5. Your Rights</h2>
            <p className='mt-2'>You have the right to:</p>
            <ul className='list-disc list-inside space-y-2 mt-2'>
              <li>Access, update, or delete your personal information.</li>
              <li>Opt out of marketing communications.</li>
              <li>Request information about how your data is processed.</li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>6. Security</h2>
            <p className='mt-2'>
              We use industry-standard measures to protect your data, but no method of transmission
              or storage is 100% secure. Please contact us immediately if you suspect unauthorized
              access to your account.
            </p>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>7. Changes to This Policy</h2>
            <p className='mt-2'>
              We may update this Privacy Policy from time to time. Any changes will be posted on
              this page, and your continued use of SyncVibe constitutes acceptance of the revised
              policy.
            </p>
          </section>

          <section>
            <h2 className='text-xl font-semibold '>8. Contact Us</h2>
            <p className='mt-2'>
              If you have any questions or concerns about this Privacy Policy, please contact us at{' '}
              <a href='mailto:info@syncvibe.xyz' className='text-blue-600 hover:underline'>
                info@syncvibe.xyz
              </a>
              .
            </p>
          </section>
        </main>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
