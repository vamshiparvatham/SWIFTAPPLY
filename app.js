const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');


const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(bodyParser.json());

const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
};
app.post('/apply-jobs', async (req, res) => {
  const { email, password, jobTitle, experience, location } = req.body;
  const screenshotsDir = path.join(__dirname, 'screenshots');
  ensureDirExists(screenshotsDir);

  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto('https://www.naukri.com/', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(screenshotsDir, 'landing-page.png') });

    await page.click('a[title="Jobseeker Login"]');
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotsDir, 'login-page.png') });

    await page.type('input[type="text"]', email, { delay: 100 });
    await page.type('input[type="password"]', password, { delay: 100 });
    await page.click('.loginButton');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    await page.screenshot({ path: path.join(screenshotsDir, 'home-page.png') });

    await page.waitForSelector('.nI-gNb-sb__full-view', { timeout: 10000 });
    await page.click('.nI-gNb-sb__full-view');
    await page.screenshot({ path: path.join(screenshotsDir, 'search-bar-page.png') });

    await page.type('.nI-gNb-sb__keywords input', jobTitle, { delay: 100 });

    await page.click('.nI-gNb-sb__expDD input');
    await page.waitForSelector('ul.dropdown', { timeout: 10000 });
    let experienceValue = experience.toLowerCase() === 'fresher' ? 'a0' : `a${experience}`;
    await page.evaluate((experienceValue) => {
      const listItems = document.querySelectorAll('ul.dropdown li');
      listItems.forEach(li => {
        if (li.getAttribute('value') === experienceValue) {
          li.scrollIntoView();
          li.click();
        }
      });
    }, experienceValue);

    await page.type('.nI-gNb-sb__locations input', location, { delay: 100 });
    await page.click('.nI-gNb-sb__icon-wrapper');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    await page.waitForSelector('.styles_jlc__main__VdwtF', { timeout: 10000 });

    const jobTitles = await page.evaluate(() => {
      const jobList = document.querySelector('.styles_jlc__main__VdwtF');
      if (!jobList) return [];
    
      const jobElements = jobList.querySelectorAll('.cust-job-tuple');
      let jobs = [];
    
      jobElements.forEach(jobElement => {
        // Modify these selectors as per the actual HTML structure of Naukri
        const designationElement = jobElement.querySelector('.row1 a');
        const companyElement = jobElement.querySelector('.row2 span a');
    
        const designation = designationElement ? designationElement.innerText.trim() : 'No designation';
        const company = companyElement ? companyElement.innerText.trim() : 'No company';
    
        jobs.push({ company, designation });
      });
    
      return jobs;
    });
    

    console.log(jobTitles);
    const jobElements = await page.$$('.cust-job-tuple'); 
    for (const jobElement of jobElements) {
      await jobElement.click();

      const newPagePromise = new Promise(resolve => browser.once('targetcreated', target => resolve(target.page())));
      const jobPage = await newPagePromise;

      await jobPage.waitForSelector('.styles_jhc__apply-button-container__5Bqnb', { timeout: 10000 });

      const applyButton = await jobPage.$('#apply-button'); 
      const saveButton1 = await jobPage.$('.styles_saved-button__Cw_V_');
      const saveButton2 = await jobPage.$('.styles_save-job-button__WLm_s');
      if (applyButton) {
        console.log("Applying for job...");
        await applyButton.click(); 
      } else if(saveButton1){
        console.log("Saving job...");
        await saveButton1.click();
      }else{
        console.log("Saving job...");
        await saveButton2.click();
      }
      await jobPage.close(); 
      await page.bringToFront(); 

      await waitFor(1000); 
    }

    await browser.close();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'su5457925@gmail.com', // Your email(s)
        pass: 'awuh ulhq dgse cyhw'     // Your app password from Google
      }
    });

    const mailOptions = {
      from: 'su5457925@gmail.com',
      to: email, 
      subject: 'Jobs Applied/Interested In',
      text: `Here are the jobs you applied for or saved:\n\n` + 
            jobTitles.map((job, index) => `${index + 1}. Company: ${job.company}, Designation: ${job.designation}`).join('\n')
    };
    

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
    res.json({ success: true, jobTitles });
  } catch (error) {
    console.error('Error applying to jobs:', error);
    res.json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
