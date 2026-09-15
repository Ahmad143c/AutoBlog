import axios from "axios";

async function test() {
  try {
    const response = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: { Authorization: `Bearer FAKE_TOKEN` }
      }
    );
    console.log("Success:", response.data);
  } catch (err: any) {
    console.log("Error:", err.response?.status, err.response?.data);
  }
}
test();
