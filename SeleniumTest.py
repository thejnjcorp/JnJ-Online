from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

options = Options()
options.add_experimental_option("detach", False)
options.add_experimental_option('excludeSwitches', ['enable-logging'])

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()),
                          options=options)

print("start test")

# Navigate to a nonexistent page for 404 page verification
print("testing 404 page")
driver.get("https://otakuo402.github.io/#/invalid-page")
InvalidPageText = driver.find_elements("xpath", "//div[contains(@class, 'Invalid-page-big-text')]")
if (InvalidPageText == []):
    print("Error, 404 page not found")
    exit(1)

# Go to home page
driver.get("https://otakuo402.github.io/#/home")
driver.maximize_window()

# get links on the home page and find the Blogs link and press it
links = driver.find_elements("xpath", "//a[@href]")
for link in links:
    if "Blog" in link.get_attribute("innerHTML"):
        link.click()
        break;

# get links on the Blog page and test all of them
linkElements = driver.find_elements("xpath", "//a[@href]")
links = [linkElement.get_attribute('href') for linkElement in linkElements]
for i in range(len(links)):
    links = driver.find_elements("xpath", "//a[@href]")
    link = links[i]
    print("testing " + link.get_attribute("innerHTML") + " button")
    # Test Home button
    if "Home" in link.get_attribute("innerHTML"):
        link.click()
        # Verify that the url is the correct url
        assert(str(driver.current_url) == "https://otakuo402.github.io/#/home")
        # Go back to previous page
        driver.back()
    # Test Blog button
    elif "Blog" in link.get_attribute("innerHTML"):
        link.click()
        # Verify that the url is the correct url
        assert(str(driver.current_url) == "https://otakuo402.github.io/#/blog")
    # Test the rest of the links
    else:
        link.click()
        # All links included should exist and should not have a 404 return
        InvalidPageText = driver.find_elements("xpath", "//div[contains(@class, 'Invalid-page-big-text')]")
        if (InvalidPageText != []):
            print("Error, page gives 404 and does not exist")
            exit(1)
        # print title
        print("title: " + driver.title)
        driver.back()
print("test completed")
